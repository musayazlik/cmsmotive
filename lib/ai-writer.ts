import { marked } from "marked";
import { EXCERPT_MAX, TITLE_MAX } from "@/app/panel/blog/_lib";
import { chatCompletion } from "@/lib/openrouter";
import {
  BIBLIOGRAPHY_HEADING,
  MIN_SOURCES,
  MIN_SUBHEADINGS,
  type Research,
  type Source,
  type WriteRequest,
  type WrittenPost,
} from "./ai-writer-shared";
import { bibliography, citeSources, research, shapeCitations } from "./ai-writer-research";
import { buildSystemPrompt, buildUserPrompt } from "./ai-writer-prompts";

/**
 * Blog text generation shared by the panel AI dialog
 * (app/api/admin/ai/generate) and the ai_write_post / ai_rewrite_post MCP
 * tools the Telegram bot uses.
 *
 * With research on (`webSearch`), writing takes two steps: a research model
 * that searches the web (Perplexity by default, or the content model's own
 * web search — Google Search for Gemini) gathers notes in which every fact
 * carries a [n] source marker; the content model then writes the post from
 * those notes only, citing the same numbers. The markers become links and a
 * numbered bibliography closes the post. No sources, no post.
 *
 * This module orchestrates the flow; the pieces live in ai-writer-shared
 * (types and constants), ai-writer-research (web research and citations)
 * and ai-writer-prompts (prompt building).
 */

export type { Source, WriteRequest, WrittenPost } from "./ai-writer-shared";

/** `##`/`###` headings at line starts — `#` is reserved for the post title. */
export function countSubheadings(markdown: string): number {
  return (markdown.match(/^#{2,3}\s+\S/gm) ?? []).length;
}

/** Models sometimes wrap JSON in prose or fences; the object is what counts. */
function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model response did not contain JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/** The editor's conversion: # and deeper than #### are clamped to h2–h4. */
export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return html.replace(/<(\/?)h([1-6])>/g, (_, slash: string, level: string) => `<${slash}h${Math.min(4, Math.max(2, Number(level)))}>`);
}

/**
 * Spots inline images at section boundaries: before the 2nd and 4th `##`
 * subheading, so the opening and the first section stay text-only. The
 * bibliography heading never counts as a section.
 */
export function insertInlineImages(markdown: string, images: { url: string; alt: string }[]): string {
  if (images.length === 0) return markdown;
  const lines = markdown.split("\n");
  const headingIndexes = lines.reduce<number[]>((found, line, index) => {
    if (line.startsWith("## ") && !/^## (?:Sources|Quellen|Kaynakça)\s*$/.test(line)) found.push(index);
    return found;
  }, []);
  const targets = [headingIndexes[1], headingIndexes[3]].filter((index) => index !== undefined);
  for (const [offset, target] of targets.reverse().entries()) {
    const image = images[targets.length - 1 - offset];
    if (!image) continue;
    lines.splice(target, 0, "", `![${image.alt.replace(/[[\]]/g, "").trim()}](${image.url})`, "");
  }
  return lines.join("\n");
}

/** Generates the requested text fields; throws when the model fails, returns no JSON or research finds nothing. */
export async function writePost(input: WriteRequest, signal?: AbortSignal): Promise<WrittenPost> {
  const result: WrittenPost = { tags: [], imagePrompts: [], sources: [], researchModel: null, warnings: [] };
  let request = input;

  const notes: Research | null = request.webSearch ? await research(request, signal) : null;

  // A rewrite without new research keeps the post's existing bibliography as it is.
  let keptBibliography = "";
  if (request.current && !notes) {
    const match = /<h2>(?:Sources|Quellen|Kaynakça|Kaynaklar)<\/h2>[\s\S]*$/i.exec(request.current.content);
    if (match) {
      keptBibliography = match[0];
      request = { ...request, current: { ...request.current, content: request.current.content.slice(0, match.index) } };
    }
  }
  if (notes) {
    signal?.throwIfAborted();
    if (notes.sources.length === 0) {
      throw new Error(
        `The web research (${notes.model}) returned no sources, so nothing was written. Try again, or pick another research model under Settings → AI.`,
      );
    }
    result.researchModel = notes.model;
  }

  const ask = (extra?: string) =>
    chatCompletion({
      model: request.model,
      system: buildSystemPrompt(request, Boolean(notes)),
      user: [buildUserPrompt(request, notes), extra].filter(Boolean).join("\n"),
      signal,
    });

  const completion = await ask();
  signal?.throwIfAborted();
  let generated = extractJson(completion.content);
  if (request.fields.contentImages && Array.isArray(generated.imagePrompts)) {
    result.imagePrompts = generated.imagePrompts
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, 2);
  }

  // The 5-section minimum is worth one explicit retry: models under-deliver
  // structure on the first pass more often than not.
  if (
    request.fields.content &&
    typeof generated.content === "string" &&
    countSubheadings(generated.content) < MIN_SUBHEADINGS
  ) {
    try {
      const retry = await ask(
        `Your draft did not meet the structure requirement. Rewrite the full post with at least ${MIN_SUBHEADINGS} ## subheadings.`,
      );
      const retryGenerated = extractJson(retry.content);
      if (
        typeof retryGenerated.content === "string" &&
        countSubheadings(retryGenerated.content) >= countSubheadings(generated.content)
      ) {
        generated = retryGenerated;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      // keep the first draft; the warning below still reports the shortfall
    }
  }

  if (request.fields.title && typeof generated.title === "string") {
    result.title = generated.title.trim().slice(0, TITLE_MAX);
  }
  if (request.fields.description && typeof generated.description === "string") {
    // Markers have no place in a meta description.
    result.description = generated.description.replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "").trim().slice(0, EXCERPT_MAX);
  }
  if (request.fields.content && typeof generated.content === "string") {
    let content = generated.content.trim();
    const subheadings = countSubheadings(content);
    if (subheadings < MIN_SUBHEADINGS) {
      result.warnings.push(
        `The draft has only ${subheadings} of ${MIN_SUBHEADINGS} subheadings — consider adding more sections.`,
      );
    }
    if (notes) {
      const { markdown, cited } = citeSources(content, notes.sources);
      let listed: Source[] = cited;
      if (cited.length === 0) {
        // Uncited text still gets the research it was based on, so the post never lacks sources.
        listed = notes.sources.slice(0, 10).map((source, index) => ({ ...source, n: index + 1 }));
        result.warnings.push("The text does not cite its sources inline; the bibliography lists the main research sources.");
      } else if (cited.length < MIN_SOURCES) {
        result.warnings.push(`The text cites only ${cited.length} source(s); double-check the facts.`);
      }
      result.sources = listed;
      content = `${shapeCitations(markdown, request.inlineCitations ?? "none")}\n\n${bibliography(listed, BIBLIOGRAPHY_HEADING[request.language])}`;
    } else if (keptBibliography) {
      content = `${content}\n\n${keptBibliography}`;
    }
    result.content = content;
  }
  if (request.fields.category) {
    const category = typeof generated.category === "string" ? generated.category.trim().slice(0, 60) : "";
    result.category = category || null;
  }
  if (request.fields.tags) {
    const tags = Array.isArray(generated.tags) ? generated.tags : [];
    result.tags = tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  return result;
}
