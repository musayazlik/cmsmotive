import { EXCERPT_MAX, TITLE_MAX } from "@/app/panel/blog/_lib";
import {
  CURRENT_CONTENT_MAX,
  DEPTH_WORDS,
  MIN_SUBHEADINGS,
  type Research,
  type WriteRequest,
} from "./ai-writer-shared";

/**
 * System and user prompts for the AI writer, fed to chatCompletion() by
 * writePost() in ai-writer.
 */

export function buildSystemPrompt(request: WriteRequest, researched: boolean): string {
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

export function buildUserPrompt(request: WriteRequest, notes: Research | null): string {
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
