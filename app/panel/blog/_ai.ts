import type { CoverRef } from "./_lib";

/**
 * Client-safe types for the AI content dialog. Shared between the panel
 * components and the /api/admin/ai routes so both sides agree on the payload
 * without importing server code into the client bundle.
 */

export type AiModelInfo = {
  id: string;
  name: string;
  context: number | null;
  /** USD per 1M tokens; null when OpenRouter reports no pricing. */
  priceIn: number | null;
  priceOut: number | null;
  free: boolean;
};

export const AI_STYLES = ["informative", "conversational", "persuasive", "technical"] as const;
export type AiStyle = (typeof AI_STYLES)[number];
export const AI_STYLE_LABELS: Record<AiStyle, string> = {
  informative: "Informative",
  conversational: "Conversational",
  persuasive: "Persuasive",
  technical: "Technical",
};

export const AI_DEPTHS = ["concise", "standard", "in-depth"] as const;
export type AiDepth = (typeof AI_DEPTHS)[number];
export const AI_DEPTH_LABELS: Record<AiDepth, string> = {
  concise: "Concise",
  standard: "Standard",
  "in-depth": "In-depth",
};

export const AI_LANGUAGES = ["en", "de", "tr"] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];
export const AI_LANGUAGE_LABELS: Record<AiLanguage, string> = {
  en: "English",
  de: "German",
  tr: "Turkish",
};

export type AiFields = {
  title: boolean;
  description: boolean;
  content: boolean;
  /** Generate illustrations embedded inside the post body. Requires content. */
  contentImages: boolean;
  cover: boolean;
  category: boolean;
  tags: boolean;
};

export type AiGenerateRequest = {
  fields: AiFields;
  topic: string;
  style: AiStyle;
  depth: AiDepth;
  language: AiLanguage;
  webSearch: boolean;
  model: string;
  imageModel: string;
  categories: string[];
  tags: string[];
};

export type AiGenerateResult = {
  title?: string;
  description?: string;
  /** Markdown; the client converts it to the editor's HTML. */
  content?: string;
  /** Exact name of an existing category, or null when nothing fits. */
  category?: string | null;
  tags: string[];
  cover: CoverRef | null;
  warnings: string[];
};
