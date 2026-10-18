import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AI_DEPTHS, AI_LANGUAGES, AI_STYLES } from "@/app/panel/blog/_ai";
import { DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, pickModel, type AiSettings } from "@/lib/ai-settings-shared";
import { insertInlineImages, markdownToHtml, writePost, type WriteRequest } from "@/lib/ai-writer";
import { imageGeneration, isOpenRouterConfigured, listTextAndImageModels } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/settings";
import { slugify } from "@/lib/slug";
import { getModelOverrides, resolveMcpActor } from "../context";
import { updateMediaRecord, uploadMediaRecord } from "../lib/media";
import { isPostStatus } from "@/app/panel/blog/_lib";
import { savePostRecord } from "../lib/posts";
import { runTool, ToolError } from "../lib/result";

/** Same house style as the panel's AI cover and inline images (app/api/admin/ai/generate). */
const STYLE_GUIDE: Record<"cover" | "inline" | "free", string> = {
  cover:
    "Blog cover illustration. Clean, modern flat vector illustration, generous negative space, 16:9 composition. Brand palette: indigo #4353e8 and lime #c6f36a accents on a light #f7f8f5 background. The image must contain no text at all: no titles, words, letters, numbers, labels, logos or watermarks.",
  inline:
    "Inline blog illustration. Clean, modern flat vector illustration, 16:9 composition. Brand palette: indigo #4353e8 and lime #c6f36a accents on a light #f7f8f5 background. The image must contain no text at all: no titles, words, letters, numbers, labels, logos or watermarks.",
  free: "",
};

/**
 * A cover prompt that describes a scene instead of quoting the title: image
 * models tend to paint a quoted title onto the picture, typos included.
 */
function coverScene(topic: string, scene?: string): string {
  return `Wordless conceptual scene${scene ? `: ${scene}` : ""}. Visual metaphor for this subject, shown only through objects, people and shapes: ${topic.replace(/["“”]/g, "")}.`;
}

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/** The source of an edit as a data URL, so the image provider never has to reach our storage. */
async function sourceAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new ToolError(`Could not download the source image: HTTP ${response.status}.`);
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mime.startsWith("image/")) throw new ToolError("The source is not an image.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_SOURCE_BYTES) throw new ToolError("The source image is larger than 8 MB.");
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function resolveImageModel(requested: string | undefined): Promise<string> {
  const { image } = await listTextAndImageModels();
  if (requested) {
    if (!image.some((model) => model.id === requested)) throw new ToolError(`"${requested}" is not an available image model.`);
    return requested;
  }
  const imageModel = getModelOverrides().image || (await getAiSettings()).imageModel;
  const model = pickModel(image, imageModel ? [imageModel, ...DEFAULT_IMAGE_MODELS] : DEFAULT_IMAGE_MODELS);
  if (!model) throw new ToolError("OpenRouter offers no image models right now.");
  return model;
}

/** The caller's override (Telegram), else Settings → AI, else the first available fallback. */
async function resolveTextModel(settings: AiSettings): Promise<string> {
  const { text } = await listTextAndImageModels();
  const textModel = getModelOverrides().text || settings.textModel;
  const model = pickModel(text, textModel ? [textModel, ...DEFAULT_TEXT_MODELS] : DEFAULT_TEXT_MODELS);
  if (!model) throw new ToolError("OpenRouter offers no text models right now.");
  return model;
}

/** Style options shared by the writing tools; omitted ones come from Settings → AI. */
const WRITING_OPTIONS = {
  style: z.enum(AI_STYLES).optional(),
  depth: z.enum(AI_DEPTHS).optional().describe("concise ≈400, standard ≈800, in-depth ≈1400 words."),
  language: z.enum(AI_LANGUAGES).optional().describe("Post language; defaults to Settings → AI."),
  webSearch: z
    .boolean()
    .optional()
    .describe(
      "Research the web first (Settings → AI research model) and end the post with a numbered bibliography. Always on when Settings → AI requires research; otherwise pass true for news, recent events, products, versions, statistics or when the user asks for research.",
    ),
  deepResearch: z
    .boolean()
    .optional()
    .describe(
      "Use Perplexity Sonar Deep Research for this post: dozens of searches, the most thorough sources; takes several minutes and costs more. Pass true when the user asks for deep or thorough research (\"derin araştır\").",
    ),
};

/** The thorough research model used when a call asks for deep research. */
const DEEP_RESEARCH_MODEL = "perplexity/sonar-deep-research";

type WritingArgs = {
  style?: WriteRequest["style"];
  depth?: WriteRequest["depth"];
  language?: WriteRequest["language"];
  webSearch?: boolean;
  deepResearch?: boolean;
};

/** Generates (or edits) one image with the resolved image model and stores it in the media library. */
async function generateImage(
  input: { prompt: string; purpose: keyof typeof STYLE_GUIDE; sourceUrl?: string; fileBase: string; alt?: string; model?: string },
  actorId: string,
) {
  const model = await resolveImageModel(input.model);
  const editing = Boolean(input.sourceUrl);
  const dataUrl = await imageGeneration({
    model,
    prompt: editing
      ? `Edit the attached image: ${input.prompt}. Keep everything else as it is.`
      : [input.prompt, STYLE_GUIDE[input.purpose]].filter(Boolean).join(" "),
    images: input.sourceUrl ? [await sourceAsDataUrl(input.sourceUrl)] : undefined,
  });
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? "image/png";
  const base = slugify(input.fileBase).slice(0, 40) || "ai-image";
  let media = await uploadMediaRecord(
    { fileName: `${base}-ai${editing ? "-edit" : ""}.${mime.split("/")[1] || "png"}`, dataUrl },
    actorId,
  );
  if (input.alt?.trim()) media = await updateMediaRecord(media.id, { alt: input.alt.trim().slice(0, 200) });
  return { media, model, edited: editing };
}

async function writingRequest(
  args: WritingArgs,
  topic: string,
  fields: WriteRequest["fields"],
  current?: WriteRequest["current"],
): Promise<WriteRequest> {
  if (!isOpenRouterConfigured()) throw new ToolError("OPENROUTER_API_KEY is not configured.");
  const settings = await getAiSettings();
  const [model, categories, tags] = await Promise.all([
    resolveTextModel(settings),
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 60 }),
  ]);
  return {
    topic,
    style: args.style ?? settings.style,
    depth: args.depth ?? settings.depth,
    language: args.language ?? settings.language,
    // When Settings → AI requires research, a caller cannot switch it off; it can only switch it on.
    webSearch: settings.webSearch || args.webSearch === true || args.deepResearch === true,
    researchModel: args.deepResearch ? DEEP_RESEARCH_MODEL : settings.researchModel,
    inlineCitations: settings.inlineCitations,
    model,
    categories: categories.map((category) => category.name),
    tags: tags.map((tag) => tag.name),
    fields,
    current,
  };
}

/** Existing categories/tags whose names match the suggestions, case-insensitively. */
async function matchTaxonomy(category: string | null | undefined, tags: string[]) {
  const [matchedCategory, matchedTags] = await Promise.all([
    category
      ? prisma.category.findFirst({
          where: { name: { equals: category, mode: "insensitive" } },
          select: { id: true, name: true },
        })
      : null,
    tags.length
      ? prisma.tag.findMany({
          where: { OR: tags.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const found = new Set(matchedTags.map((tag) => tag.name.toLowerCase()));
  return {
    category: matchedCategory,
    newCategory: category && !matchedCategory ? category : null,
    tags: matchedTags,
    newTags: tags.filter((name) => !found.has(name.toLowerCase())),
  };
}

const wordCount = (markdown: string) => markdown.split(/\s+/).filter(Boolean).length;

export function registerAiTools(server: McpServer) {
  server.registerTool(
    "ai_write_post",
    {
      title: "Write a blog post with AI",
      description:
        "Write a complete blog post (title, excerpt, structured body) from a brief with the content model chosen under Settings → AI, and save it as a draft — including, in the same call, up to two illustrations placed between sections (inlineImages) and a cover image (cover). Existing categories/tags that match the suggestions are attached; suggestions without a match come back as newCategory/newTags (create them with the taxonomy tools if wanted). With research on it first searches the web and the post ends with a numbered bibliography; no sources found means no post. Prefer this over writing post bodies or adding images yourself. Takes one to several minutes.",
      inputSchema: {
        brief: z.string().min(3).max(2000).describe("Topic, angle, audience and any must-have points."),
        ...WRITING_OPTIONS,
        inlineImages: z
          .number()
          .int()
          .min(0)
          .max(2)
          .default(0)
          .describe("Illustrations generated and placed inside the post, before the 2nd and 4th section."),
        cover: z.boolean().default(false).describe("Generate a cover image and set it as the post's cover."),
      },
      annotations: { destructiveHint: false, openWorldHint: true },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        const request = await writingRequest(args, args.brief, {
          title: true,
          description: true,
          content: true,
          contentImages: args.inlineImages > 0,
          category: true,
          tags: true,
        });
        const written = await writePost(request);
        if (!written.title || !written.content) {
          throw new ToolError("The content model returned no title or body. Try again or pick another model under Settings → AI.");
        }
        const warnings = [...written.warnings];
        const base = written.title;

        // Images are extras: a failed one is reported, the post is still saved.
        let markdown = written.content;
        const inline: { id: string; url: string; alt: string }[] = [];
        for (let index = 0; index < args.inlineImages; index += 1) {
          const scene = written.imagePrompts[index] ?? `Editorial scene illustrating: ${written.title}`;
          try {
            const { media } = await generateImage(
              { prompt: `${scene}. Context: ${written.title}.`, purpose: "inline", fileBase: `${base}-inline-${index + 1}`, alt: scene },
              actor.id,
            );
            inline.push({ id: media.id, url: media.url, alt: scene });
          } catch (error) {
            warnings.push(`Inline image ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        markdown = insertInlineImages(markdown, inline);

        let coverId: string | null = null;
        if (args.cover) {
          try {
            const { media } = await generateImage(
              { prompt: coverScene(written.description || written.title), purpose: "cover", fileBase: `${base}-cover`, alt: written.title },
              actor.id,
            );
            coverId = media.id;
          } catch (error) {
            warnings.push(`Cover image failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        const taxonomy = await matchTaxonomy(written.category, written.tags);
        const saved = await savePostRecord(
          {
            title: written.title,
            slug: "",
            excerpt: written.description ?? "",
            content: markdownToHtml(markdown),
            coverId,
            status: "draft",
            scheduledAt: null,
            featured: false,
            categoryId: taxonomy.category?.id ?? null,
            tagIds: taxonomy.tags.map((tag) => tag.id),
          },
          actor.id,
        );
        return {
          post: { id: saved.id, slug: saved.slug, status: "draft", title: written.title },
          excerpt: written.description ?? "",
          words: wordCount(written.content),
          language: request.language,
          model: request.model,
          category: taxonomy.category,
          newCategory: taxonomy.newCategory,
          tags: taxonomy.tags,
          newTags: taxonomy.newTags,
          research: written.researchModel
            ? { model: written.researchModel, sources: written.sources.length }
            : "none — written from the model's own knowledge",
          images: { coverId, inline: inline.map((image) => image.id) },
          warnings,
        };
      }),
  );

  server.registerTool(
    "ai_rewrite_post",
    {
      title: "Rewrite a blog post with AI",
      description:
        'Revise an existing post with the Settings → AI content model following an instruction ("shorter", "more technical", "translate to German", "add a section about X"). Overwrites the chosen parts in place, also on published posts; status, cover, category and tags are kept.',
      inputSchema: {
        postId: z.string(),
        instruction: z.string().min(3).max(2000),
        parts: z
          .array(z.enum(["title", "excerpt", "content"]))
          .min(1)
          .default(["content", "excerpt"])
          .describe("What to rewrite; the rest is kept."),
        ...WRITING_OPTIONS,
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        const post = await prisma.post.findUnique({
          where: { id: args.postId },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            content: true,
            coverId: true,
            status: true,
            scheduledAt: true,
            featured: true,
            categoryId: true,
            tags: { select: { tagId: true } },
          },
        });
        if (!post) throw new ToolError("Post could not be found.");
        if (!isPostStatus(post.status)) throw new ToolError("The stored post has an unknown status.");

        const parts = new Set(args.parts);
        const request = await writingRequest(
          args,
          args.instruction,
          {
            title: parts.has("title"),
            description: parts.has("excerpt"),
            content: parts.has("content"),
            contentImages: false,
            category: false,
            tags: false,
          },
          { title: post.title, excerpt: post.excerpt, content: post.content },
        );
        const written = await writePost(request);
        if (parts.has("content") && !written.content) throw new ToolError("The content model returned no body.");

        const title = parts.has("title") && written.title ? written.title : post.title;
        const excerpt = parts.has("excerpt") && written.description !== undefined ? written.description : post.excerpt;
        await savePostRecord(
          {
            id: post.id,
            title,
            slug: post.slug,
            excerpt,
            content: parts.has("content") && written.content ? markdownToHtml(written.content) : post.content,
            coverId: post.coverId,
            status: post.status,
            scheduledAt: post.scheduledAt?.toISOString() ?? null,
            featured: post.featured,
            categoryId: post.categoryId,
            tagIds: post.tags.map((entry) => entry.tagId),
          },
          actor.id,
        );
        return {
          post: { id: post.id, status: post.status, title },
          rewritten: [...parts],
          excerpt,
          words: written.content ? wordCount(written.content) : undefined,
          language: request.language,
          model: request.model,
          research: written.researchModel
            ? { model: written.researchModel, sources: written.sources.length }
            : "none — written from the model's own knowledge",
          warnings: written.warnings,
        };
      }),
  );

  server.registerTool(
    "ai_generate_image",
    {
      title: "Generate or edit an image with AI",
      description:
        "Create an image from a prompt, or edit an existing one (pass sourceMediaId or sourceImageUrl plus an instruction such as \"make the background dark\"). The result is stored in the media library; use the returned id as a post's coverId (blog_posts_update) or a theme/extension coverId. purpose \"cover\" and \"inline\" add the site's illustration style. Takes up to a minute.",
      inputSchema: {
        prompt: z.string().min(3).max(2000).describe("What to draw, or for edits what to change."),
        purpose: z.enum(["cover", "inline", "free"]).default("cover"),
        sourceMediaId: z.string().optional().describe("Media asset to edit, e.g. a post's current coverId."),
        sourceImageUrl: z.string().url().optional().describe("Public image URL to edit."),
        alt: z.string().max(200).optional().describe("Alt text stored on the new media asset."),
        fileName: z.string().max(80).optional().describe("Base file name without extension."),
        model: z.string().optional().describe("OpenRouter image model id; defaults to Settings → AI."),
      },
      annotations: { destructiveHint: false, openWorldHint: true },
    },
    async (args) =>
      runTool(async () => {
        if (!isOpenRouterConfigured()) throw new ToolError("OPENROUTER_API_KEY is not configured.");
        if (args.sourceMediaId && args.sourceImageUrl) {
          throw new ToolError("Provide sourceMediaId or sourceImageUrl, not both.");
        }
        const actor = await resolveMcpActor();

        let sourceUrl = args.sourceImageUrl;
        if (args.sourceMediaId) {
          const media = await prisma.mediaAsset.findUnique({
            where: { id: args.sourceMediaId },
            select: { url: true, mimeType: true },
          });
          if (!media) throw new ToolError("The source media asset could not be found.");
          if (!media.mimeType.startsWith("image/")) throw new ToolError("The source media asset is not an image.");
          sourceUrl = media.url;
        }

        return generateImage(
          {
            prompt: args.prompt,
            purpose: args.purpose,
            sourceUrl,
            fileBase: args.fileName ?? args.prompt,
            alt: args.alt,
            model: args.model,
          },
          actor.id,
        );
      }),
  );
}
