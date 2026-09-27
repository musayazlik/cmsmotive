import { prisma } from "@/lib/prisma";
import { utapi } from "@/lib/utapi";
import { requireAdmin } from "@/lib/admin-guard";
import {
  chatCompletion,
  imageGeneration,
  isOpenRouterConfigured,
  type ChatCitation,
} from "@/lib/openrouter";
import { slugify } from "@/lib/slug";
import { EXCERPT_MAX, TITLE_MAX } from "@/app/panel/blog/_lib";
import {
  AI_DEPTHS,
  AI_LANGUAGES,
  AI_STYLES,
  type AiGenerateRequest,
  type AiGenerateResult,
} from "@/app/panel/blog/_ai";

export const runtime = "nodejs";

const DEPTH_WORDS: Record<AiGenerateRequest["depth"], string> = {
  concise: "roughly 400 words",
  standard: "roughly 800 words",
  "in-depth": "roughly 1400 words",
};

/** Every generated post must be structured into at least this many sections. */
const MIN_SUBHEADINGS = 5;

const SOURCES_HEADING: Record<AiGenerateRequest["language"], string> = {
  en: "Sources",
  de: "Quellen",
  tr: "Kaynaklar",
};

/** `##`/`###` headings at line starts — `#` is reserved for the post title. */
function countSubheadings(markdown: string): number {
  return (markdown.match(/^#{2,3}\s+\S/gm) ?? []).length;
}

/** Appends the web sources the model grounded on as the closing section. */
function appendSources(markdown: string, citations: ChatCitation[], heading: string): string {
  if (citations.length === 0) return markdown;
  const lines = citations.slice(0, 10).map(({ url, title }) => {
    const label = (title ?? new URL(url).hostname).replace(/[[\]]/g, "").trim();
    return `- [${label}](${url})`;
  });
  return `${markdown}\n\n## ${heading}\n\n${lines.join("\n")}`;
}

/**
 * Spots inline images at section boundaries: before the 2nd and 4th
 * `##` subheading, so the opening and the first section stay text-only.
 */
function insertInlineImages(markdown: string, images: { url: string; alt: string }[]): string {
  if (images.length === 0) return markdown;
  const lines = markdown.split("\n");
  const headingIndexes = lines.reduce<number[]>((found, line, index) => {
    if (line.startsWith("## ")) found.push(index);
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

/** Models sometimes wrap JSON in prose or fences; the object is what counts. */
function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model response did not contain JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/** Validates the body so a bad client cannot reach the OpenRouter calls. */
function parseRequest(body: Record<string, unknown>): AiGenerateRequest | string {
  const fieldsIn = (body.fields ?? {}) as Record<string, unknown>;
  const fields = {
    title: fieldsIn.title === true,
    description: fieldsIn.description === true,
    content: fieldsIn.content === true,
    contentImages: fieldsIn.contentImages === true && fieldsIn.content === true,
    cover: fieldsIn.cover === true,
    category: fieldsIn.category === true,
    tags: fieldsIn.tags === true,
  };
  if (!Object.values(fields).some(Boolean)) return "Select at least one field to generate.";

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < 3 || topic.length > 2000) return "Describe the topic in 3 to 2000 characters.";

  if (typeof body.model !== "string" || !body.model.trim()) return "Pick a text model.";
  if ((fields.cover || fields.contentImages) && (typeof body.imageModel !== "string" || !body.imageModel.trim())) {
    return "Pick an image model for the images.";
  }

  const style = AI_STYLES.includes(body.style as never) ? (body.style as AiGenerateRequest["style"]) : "informative";
  const depth = AI_DEPTHS.includes(body.depth as never) ? (body.depth as AiGenerateRequest["depth"]) : "standard";
  const language = AI_LANGUAGES.includes(body.language as never)
    ? (body.language as AiGenerateRequest["language"])
    : "en";
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 60) : [];

  return {
    fields,
    topic,
    style,
    depth,
    language,
    webSearch: body.webSearch === true,
    model: (body.model as string).trim(),
    imageModel: typeof body.imageModel === "string" ? body.imageModel.trim() : "",
    categories: list(body.categories),
    tags: list(body.tags),
  };
}

function buildSystemPrompt(request: AiGenerateRequest): string {
  const languageName = { en: "English", de: "German", tr: "Turkish" }[request.language];
  return [
    `You write blog content for CMSMotive, a vendor of themes and extensions for TYPO3, the enterprise CMS.`,
    `The audience is agencies, developers and marketing teams evaluating TYPO3 products.`,
    `Write in ${languageName}. Style: ${request.style}. Depth: ${request.depth} (${DEPTH_WORDS[request.depth]}).`,
    request.webSearch
      ? "Web search results are available — ground facts, product names and versions in them and stay current."
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
          request.webSearch ? ". Do not add a sources or references list yourself — sources are appended automatically" : ""
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

function buildUserPrompt(request: AiGenerateRequest): string {
  return [
    `Topic / brief: ${request.topic}`,
    request.categories.length > 0 ? `Existing categories: ${request.categories.join(", ")}` : "There are no categories yet.",
    request.tags.length > 0 ? `Existing tags: ${request.tags.join(", ")}` : "There are no tags yet.",
    "Write the JSON object now.",
  ].join("\n");
}

/** Turns a generated data URL into a tracked MediaAsset. */
async function storeAiImage(userId: string, dataUrl: string, baseName: string): Promise<{ assetId: string; url: string; name: string }> {
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/png";
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  const fileName = `${baseName}-ai.${mime.split("/")[1] || "png"}`;

  const upload = await utapi.uploadFiles(new File([buffer], fileName, { type: mime }));
  if (upload.error) throw new Error(`Image upload failed: ${upload.error.message}`);

  const asset = await prisma.mediaAsset.create({
    data: {
      key: upload.data.key,
      url: upload.data.ufsUrl,
      fileName: upload.data.name,
      fileSize: upload.data.size,
      mimeType: upload.data.type,
      uploadedById: userId,
    },
    select: { id: true },
  });
  return { assetId: asset.id, url: upload.data.ufsUrl, name: upload.data.name };
}

/** POST /api/admin/ai/generate — generates the selected blog fields. */
export async function POST(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;

  if (!isOpenRouterConfigured()) {
    return Response.json(
      { error: "OpenRouter is not configured. Add OPENROUTER_API_KEY to the environment." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseRequest(body);
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  const request_ = parsed;

  const result: AiGenerateResult = { tags: [], cover: null, warnings: [] };
  /** Visual scene descriptions for inline images, written by the text model. */
  let imagePromptCandidates: string[] = [];

  try {
    const completion = await chatCompletion({
      model: request_.model,
      system: buildSystemPrompt(request_),
      user: buildUserPrompt(request_),
      webSearch: request_.webSearch,
      signal: request.signal,
    });
    request.signal.throwIfAborted();
    let generated = extractJson(completion.content);
    let citations = completion.citations;
    if (request_.fields.contentImages && Array.isArray(generated.imagePrompts)) {
      imagePromptCandidates = generated.imagePrompts
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .slice(0, 2);
    }

    // The 5-section minimum is worth one explicit retry: models under-deliver
    // structure on the first pass more often than not.
    if (
      request_.fields.content &&
      typeof generated.content === "string" &&
      countSubheadings(generated.content) < MIN_SUBHEADINGS
    ) {
      try {
        const retry = await chatCompletion({
          model: request_.model,
          system: buildSystemPrompt(request_),
          user: [
            buildUserPrompt(request_),
            `Your draft did not meet the structure requirement. Rewrite the full post with at least ${MIN_SUBHEADINGS} ## subheadings.`,
          ].join("\n"),
          webSearch: request_.webSearch,
          signal: request.signal,
        });
        const retryGenerated = extractJson(retry.content);
        if (
          typeof retryGenerated.content === "string" &&
          countSubheadings(retryGenerated.content) >= countSubheadings(generated.content)
        ) {
          generated = retryGenerated;
          citations = retry.citations;
        }
      } catch (error) {
        if (request.signal.aborted) throw error;
        // keep the first draft; the warning below still reports the shortfall
      }
    }

    if (request_.fields.title && typeof generated.title === "string") {
      result.title = generated.title.trim().slice(0, TITLE_MAX);
    }
    if (request_.fields.description && typeof generated.description === "string") {
      result.description = generated.description.trim().slice(0, EXCERPT_MAX);
    }
    if (request_.fields.content && typeof generated.content === "string") {
      let content = generated.content.trim();
      const subheadings = countSubheadings(content);
      if (subheadings < MIN_SUBHEADINGS) {
        result.warnings.push(
          `The draft has only ${subheadings} of ${MIN_SUBHEADINGS} subheadings — consider adding more sections.`,
        );
      }
      if (request_.webSearch) {
        content = appendSources(content, citations, SOURCES_HEADING[request_.language]);
      }
      result.content = content;
    }
    if (request_.fields.category) {
      const category = typeof generated.category === "string" ? generated.category.trim().slice(0, 60) : "";
      result.category = category || null;
    }
    if (request_.fields.tags) {
      const tags = Array.isArray(generated.tags) ? generated.tags : [];
      result.tags = tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("ai generate: text failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Text generation failed." },
      { status: 502 },
    );
  }

  if (request_.fields.contentImages && result.content) {
    try {
      request.signal.throwIfAborted();
      const fallbackPrompt = `Editorial scene illustrating: ${result.title ?? request_.topic}`;
      const prompts = imagePromptCandidates.length > 0 ? imagePromptCandidates : [fallbackPrompt, fallbackPrompt];
      const base = slugify(result.title ?? request_.topic).slice(0, 40) || "ai-inline";
      const images: { url: string; alt: string }[] = [];
      for (const [index, description] of prompts.entries()) {
        request.signal.throwIfAborted();
        const dataUrl = await imageGeneration({
          model: request_.imageModel,
          prompt: [
            `Inline blog illustration: ${description}. Context: ${result.title ?? request_.topic}.`,
            "Clean, modern flat vector illustration, 16:9 composition.",
            "Brand palette: indigo #4353e8 and lime #c6f36a accents on a light #f7f8f5 background.",
            "No text, no letters, no watermarks.",
          ].join(" "),
          signal: request.signal,
        });
        request.signal.throwIfAborted();
        const stored = await storeAiImage(session.user.id, dataUrl, `${base}-inline-${index + 1}`);
        images.push({ url: stored.url, alt: description });
      }
      result.content = insertInlineImages(result.content, images);
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("ai generate: inline images failed", error);
      result.warnings.push(
        `In-content images failed: ${error instanceof Error ? error.message : "unknown error"}. The text was generated without them.`,
      );
    }
  }

  if (request_.fields.cover) {
    try {
      request.signal.throwIfAborted();
      const dataUrl = await imageGeneration({
        model: request_.imageModel,
        prompt: [
          `Blog cover illustration for an article about: ${result.title ?? request_.topic}.`,
          "Clean, modern flat vector illustration, generous negative space, 16:9 composition.",
          "Brand palette: indigo #4353e8 and lime #c6f36a accents on a light #f7f8f5 background.",
          "No text, no letters, no watermarks.",
        ].join(" "),
        signal: request.signal,
      });
      request.signal.throwIfAborted();
      const stored = await storeAiImage(session.user.id, dataUrl, `${slugify(result.title ?? request_.topic).slice(0, 40) || "ai-cover"}`);
      result.cover = stored;
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("ai generate: cover failed", error);
      result.warnings.push(
        `Cover image failed: ${error instanceof Error ? error.message : "unknown error"}. Everything else was generated.`,
      );
    }
  }

  if (request.signal.aborted) return new Response(null, { status: 499 });
  return Response.json(result);
}
