import type { AiGenerateRequest } from "@/app/panel/blog/_ai";
import type { InlineCitations } from "@/lib/ai-settings-shared";

/**
 * Types and constants shared by the ai-writer modules: research
 * (ai-writer-research), prompt building (ai-writer-prompts) and the
 * writePost orchestration in ai-writer.
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

/** Research notes the writer works from; empty sources abort the writing. */
export type Research = { notes: string; sources: Source[]; model: string };

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

export {
  BIBLIOGRAPHY_HEADING,
  CURRENT_CONTENT_MAX,
  DEPTH_WORDS,
  MIN_SOURCES,
  MIN_SUBHEADINGS,
};
