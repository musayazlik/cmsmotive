import { storeMediaFile } from "@/lib/media-storage";
import { requireAdmin } from "@/lib/admin-guard";
import { insertInlineImages, writePost } from "@/lib/ai-writer";
import { getAiSettings } from "@/lib/settings";
import { imageGeneration, isOpenRouterConfigured } from "@/lib/openrouter";
import { slugify } from "@/lib/slug";
import {
  AI_DEPTHS,
  AI_LANGUAGES,
  AI_STYLES,
  type AiGenerateRequest,
  type AiGenerateResult,
} from "@/app/panel/blog/_ai";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

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

/** Turns a generated data URL into a tracked MediaAsset. */
async function storeAiImage(storeId: string, userId: string, dataUrl: string, baseName: string): Promise<{ assetId: string; url: string; name: string }> {
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/png";
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  const fileName = `${baseName}-ai.${mime.split("/")[1] || "png"}`;

  const asset = await storeMediaFile(storeId, userId, new File([new Uint8Array(buffer)], fileName, { type: mime }));
  return { assetId: asset.id, url: asset.url, name: asset.fileName };
}

/** POST /api/admin/ai/generate — generates the selected blog fields. */
export async function POST(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

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
    const { researchModel, inlineCitations } = await getAiSettings(storeId);
    const written = await writePost({ ...request_, researchModel, inlineCitations }, request.signal);
    request.signal.throwIfAborted();
    imagePromptCandidates = written.imagePrompts;
    result.warnings.push(...written.warnings);
    if (written.title !== undefined) result.title = written.title;
    if (written.description !== undefined) result.description = written.description;
    if (written.content !== undefined) result.content = written.content;
    if (written.category !== undefined) result.category = written.category;
    result.tags = written.tags;
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
            "The image must contain no text at all: no titles, words, letters, numbers, labels, logos or watermarks.",
          ].join(" "),
          signal: request.signal,
        });
        request.signal.throwIfAborted();
        const stored = await storeAiImage(storeId, session.user.id, dataUrl, `${base}-inline-${index + 1}`);
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
          // A described scene, not the quoted title: image models paint quoted titles onto the picture.
          `Wordless conceptual blog cover. Visual metaphor, shown only through objects, people and shapes, for: ${(result.description ?? result.title ?? request_.topic).replace(/["“”]/g, "")}.`,
          "Clean, modern flat vector illustration, generous negative space, 16:9 composition.",
          "Brand palette: indigo #4353e8 and lime #c6f36a accents on a light #f7f8f5 background.",
          "The image must contain no text at all: no titles, words, letters, numbers, labels, logos or watermarks.",
        ].join(" "),
        signal: request.signal,
      });
      request.signal.throwIfAborted();
      const stored = await storeAiImage(storeId, session.user.id, dataUrl, `${slugify(result.title ?? request_.topic).slice(0, 40) || "ai-cover"}`);
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
