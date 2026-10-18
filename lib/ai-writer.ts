import { marked } from "marked";
import { EXCERPT_MAX, TITLE_MAX } from "@/app/panel/blog/_lib";
import type { AiGenerateRequest } from "@/app/panel/blog/_ai";
import { DEFAULT_RESEARCH_MODEL, NATIVE_RESEARCH, type InlineCitations } from "@/lib/ai-settings-shared";
import { chatCompletion, type ChatCitation } from "@/lib/openrouter";

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
 */

const DEPTH_WORDS: Record<AiGenerateRequest["depth"], string> = {
  concise: "roughly 400 words",
  standard: "roughly 800 words",
  "in-depth": "roughly 1400 words",
};

/** Every generated post must be structured into at least this many sections. */
const MIN_SUBHEADINGS = 5;

/** Fewer sources than this still produce a post, with a warning. */
const MIN_SOURCES = 3;

const BIBLIOGRAPHY_HEADING: Record<AiGenerateRequest["language"], string> = {
  en: "Sources",
  de: "Quellen",
  tr: "Kaynakça",
};

/** Longest current post body sent along when rewriting, in characters. */
const CURRENT_CONTENT_MAX = 24_000;

export type WriteRequest = Pick<
  AiGenerateRequest,
  "topic" | "style" | "depth" | "language" | "webSearch" | "model" | "categories" | "tags"
> & {
  fields: Pick<AiGenerateRequest["fields"], "title" | "description" | "content" | "contentImages" | "category" | "tags">;
  /** Rewrite this post instead of writing a new one; `topic` is then the instruction. */
  current?: { title: string; excerpt: string; content: string };
  /** Settings → AI research model: "" = Perplexity Sonar Pro, NATIVE_RESEARCH = the content model's web search. */
  researchModel?: string;
  /** How many of the writer's [n] markers stay in the text; the bibliography is kept either way. */
  inlineCitations?: InlineCitations;
};

export type Source = { n: number; url: string; title: string | null };

export type WrittenPost = {
  title?: string;
  description?: string;
  /** Markdown; markdownToHtml() turns it into editor HTML. Ends with the bibliography when researched. */
  content?: string;
  category?: string | null;
  tags: string[];
  /** Scene descriptions for inline images (only when contentImages was requested). */
  imagePrompts: string[];
  /** The bibliography, in citation order; empty without research. */
  sources: Source[];
  /** Model that did the research, when there was research. */
  researchModel: string | null;
  warnings: string[];
};

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

/* ---------------------------------------------------------------- research */

type Research = { notes: string; sources: Source[]; model: string };

function researchModelFor(request: WriteRequest): string {
  if (!request.researchModel) return DEFAULT_RESEARCH_MODEL;
  return request.researchModel === NATIVE_RESEARCH ? request.model : request.researchModel;
}

/**
 * Web research ahead of writing. The research model's own [n] markers point
 * at its raw source list (duplicates included); they are renumbered here so
 * the bibliography lists each URL once, in the order it is first cited.
 */
async function research(request: WriteRequest, signal?: AbortSignal): Promise<Research> {
  const model = researchModelFor(request);
  const subject = request.current
    ? `Research for revising the article "${request.current.title}". What the editor wants: ${request.topic}`
    : `Research this blog topic: ${request.topic}`;
  const result = await chatCompletion({
    model,
    system: [
      "You are a meticulous research assistant preparing notes for a blog article.",
      `Today is ${new Date().toISOString().slice(0, 10)}. Search the web and gather current, verifiable information.`,
      "Write detailed research notes in English: key facts, figures, dates, names, short quotes, background, and differing viewpoints.",
      "Put a source marker like [1] directly after every fact. Prefer primary and authoritative sources: official sites, documentation, security advisories, reputable news outlets.",
      "If something cannot be verified, say so explicitly instead of guessing.",
    ].join(" "),
    user: `${subject}\nAudience: agencies, developers and marketing teams working with TYPO3. Depth of the planned article: ${DEPTH_WORDS[request.depth]}.`,
    webSearch: true,
    maxResults: 10,
    // Deep-research models run many searches and can take several minutes.
    timeoutMs: /deep-research/.test(model) ? 600_000 : 240_000,
    signal,
  });

  const sources: Source[] = [];
  const numbers = new Map<string, number>();
  const numberOf = (source: ChatCitation | undefined) => {
    if (!source?.url) return null;
    let n = numbers.get(source.url);
    if (!n) {
      n = sources.length + 1;
      numbers.set(source.url, n);
      sources.push({ n, url: source.url, title: source.title });
    }
    return n;
  };
  const notes = result.content.replace(/\[(\d+)\]/g, (_match, digits: string) => {
    const n = numberOf(result.sources[Number(digits) - 1]);
    return n ? `[${n}]` : "";
  });
  // Web-plugin answers often link instead of numbering; their sources still count.
  for (const citation of result.citations) numberOf(citation);
  return { notes, sources, model };
}

/** [3], [2, 5], [1-3] or [1–3]: one marker group as written by the model. */
const MARKER_GROUP = /\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g;

function expandGroup(group: string): number[] {
  return group.split(/\s*,\s*/).flatMap((part) => {
    const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(part);
    if (!range) return [Number(part)];
    const [from, to] = [Number(range[1]), Number(range[2])];
    return to >= from && to - from < 10 ? Array.from({ length: to - from + 1 }, (_, index) => from + index) : [from, to];
  });
}

/**
 * Links every marker to its source and renumbers by first citation in the
 * post, so the bibliography lists only what the text actually cites.
 */
function citeSources(markdown: string, sources: Source[]): { markdown: string; cited: Source[] } {
  const cited: Source[] = [];
  const renumbered = new Map<number, number>();
  // Runs like [3][7][8][9] hurt readability; the first two carry the claim.
  const capped = markdown.replace(/((?:\[\d+\]){2})(?:\[\d+\])+/g, "$1");
  const linked = capped.replace(MARKER_GROUP, (_match, group: string) =>
    expandGroup(group)
      .map((old) => {
        const source = sources[old - 1];
        if (!source) return "";
        let n = renumbered.get(old);
        if (!n) {
          n = cited.length + 1;
          renumbered.set(old, n);
          cited.push({ ...source, n });
        }
        return `[[${n}]](${source.url})`;
      })
      .join(""),
  );
  return { markdown: linked, cited };
}

/** A linked marker as citeSources() writes it, with the space before it. */
const LINKED_MARKER = / ?\[\[\d+\]\]\([^)\s]+\)/g;

/**
 * The writer cites every claim so the bibliography lists exactly what the
 * post rests on; readers get either no numbers at all ("none") or one per
 * paragraph at most ("light"), so the text stays easy to read.
 */
function shapeCitations(markdown: string, style: InlineCitations): string {
  if (style === "none") return markdown.replace(LINKED_MARKER, "");
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => {
      let kept = false;
      return paragraph.replace(LINKED_MARKER, (marker) => {
        if (kept) return "";
        kept = true;
        return marker;
      });
    })
    .join("\n\n");
}

/**
 * Perplexity titles can start with a breadcrumb of the URL glued to the real
 * title ("typo3.com · typo3-v14TYPO3 v14: …"); the breadcrumb is dropped.
 */
function cleanTitle(title: string | null, url: string): string | null {
  if (!title) return null;
  let clean = title;
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (clean.includes(" · ")) {
    if (lastSegment && clean.includes(lastSegment)) {
      clean = clean.slice(clean.lastIndexOf(lastSegment) + lastSegment.length);
    } else {
      // "host · de · artikelReal title": keep the last crumb and drop the path segment glued to it.
      clean = clean.split(" · ").at(-1) ?? clean;
      const glued = segments.find((segment) => clean.startsWith(segment) && clean.length > segment.length);
      if (glued) clean = clean.slice(glued.length);
    }
  }
  clean = clean.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
  return clean.length >= 3 ? clean.slice(0, 140) : null;
}

function bibliography(sources: Source[], heading: string): string {
  const lines = sources.map(({ n, url, title }) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = cleanTitle(title, url);
    return `${n}. [${label ?? host}](${url})${label ? ` — ${host}` : ""}`;
  });
  return `## ${heading}\n\n${lines.join("\n")}`;
}

/* ----------------------------------------------------------------- writing */

function buildSystemPrompt(request: WriteRequest, researched: boolean): string {
  const languageName = { en: "English", de: "German", tr: "Turkish" }[request.language];
  return [
    `You write blog content for CMSMotive, a vendor of themes and extensions for TYPO3, the enterprise CMS.`,
    `The audience is agencies, developers and marketing teams evaluating TYPO3 products.`,
    `Write in ${languageName}. Style: ${request.style}. Depth: ${request.depth} (${DEPTH_WORDS[request.depth]}).`,
    researched
      ? "Research notes with numbered sources are provided. Base every factual statement on them and cite it with the same number right after the statement, e.g. \"… released in April 2026 [3].\" Cite each source in its own brackets ([2][5]), never grouped like [2, 5]. Use at most two numbers per statement and cite once per claim, not after every clause, so the text stays readable. Use several different sources across the post, not just one. Never invent facts, figures, quotes or sources that are not in the notes; leave out what the notes do not support."
      : "Do not invent statistics, dates or product versions you are unsure about.",
    `Return ONLY a minified JSON object — no markdown fences, no commentary — containing only these requested keys:`,
    request.fields.title
      ? `"title": SEO headline, at most ${TITLE_MAX} characters, no surrounding quotes`
      : "",
    request.fields.description
      ? `"description": meta description, at most ${EXCERPT_MAX} characters, states the promise of the post`
      : "",
    request.fields.content
      ? `"content": the post body in markdown — short intro paragraph, then AT LEAST ${MIN_SUBHEADINGS} ## subheadings (### for subsections, never #), short paragraphs, bullet lists where they help, closing takeaway${
          researched ? ". Do not add a sources, references or bibliography section — it is appended automatically" : ""
        }`
      : "",
    request.fields.contentImages
      ? `"imagePrompts": exactly 2 strings, each a concrete visual scene (max 12 words) illustrating a different section of the post, suitable as image-generation prompts`
      : "",
    request.fields.category
      ? `"category": the one category name that best matches what the content is actually about — reuse a provided category when it truly fits, otherwise coin a short new category name (1-3 words) naming the content's subject`
      : "",
    request.fields.tags
      ? `"tags": up to 5 short lowercase tags, preferring the provided ones`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUserPrompt(request: WriteRequest, notes: Research | null): string {
  const brief = request.current
    ? [
        `Revise the existing post below. Instruction: ${request.topic}`,
        "Keep what the instruction does not ask to change.",
        `Current title: ${request.current.title}`,
        `Current description: ${request.current.excerpt}`,
        `Current content (HTML): ${request.current.content.slice(0, CURRENT_CONTENT_MAX)}`,
      ]
    : [`Topic / brief: ${request.topic}`];
  const researchBlock = notes
    ? [
        "Research notes:",
        notes.notes,
        "Sources:",
        ...notes.sources.map((source) => `[${source.n}] ${source.title ?? ""} ${source.url}`.replace(/\s+/g, " ")),
      ]
    : [];
  return [
    ...brief,
    ...researchBlock,
    request.categories.length > 0 ? `Existing categories: ${request.categories.join(", ")}` : "There are no categories yet.",
    request.tags.length > 0 ? `Existing tags: ${request.tags.join(", ")}` : "There are no tags yet.",
    "Write the JSON object now.",
  ].join("\n");
}

/** Generates the requested text fields; throws when the model fails, returns no JSON or research finds nothing. */
export async function writePost(input: WriteRequest, signal?: AbortSignal): Promise<WrittenPost> {
  const result: WrittenPost = { tags: [], imagePrompts: [], sources: [], researchModel: null, warnings: [] };
  let request = input;

  const notes = request.webSearch ? await research(request, signal) : null;

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
      let listed = cited;
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
