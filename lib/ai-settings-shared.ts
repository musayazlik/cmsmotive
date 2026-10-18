import {
  AI_DEPTHS,
  AI_LANGUAGES,
  AI_STYLES,
  type AiDepth,
  type AiLanguage,
  type AiStyle,
} from "@/app/panel/blog/_ai";

/** Client-safe contract for the defaults the blog AI dialog opens with. */

export type AiSettings = {
  /** OpenRouter model id; "" picks the dialog's built-in preference list. */
  textModel: string;
  imageModel: string;
  style: AiStyle;
  depth: AiDepth;
  language: AiLanguage;
  /** Research the web before writing and end every post with a bibliography. */
  webSearch: boolean;
  /** Model that researches; NATIVE_RESEARCH = the content model with its built-in web search. */
  researchModel: string;
  /** Source numbers in the text: "none" = bibliography only, "light" = at most one per paragraph. */
  inlineCitations: InlineCitations;
};

export const INLINE_CITATIONS = ["none", "light"] as const;
export type InlineCitations = (typeof INLINE_CITATIONS)[number];

/** Research with the content model's own web search (Google Search for Gemini models). */
export const NATIVE_RESEARCH = "native";

/** Searches the web itself, cites every fact and is priced per search. */
export const DEFAULT_RESEARCH_MODEL = "perplexity/sonar-pro";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  textModel: "",
  imageModel: "",
  style: "informative",
  depth: "standard",
  language: "en",
  webSearch: true,
  researchModel: "",
  inlineCitations: "none",
};

const MODEL_ID = /^[\w.:/-]{1,120}$/;

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export function validateAiSettings(input: Record<string, unknown>): { error: string } | { data: AiSettings } {
  const model = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
  const textModel = model("textModel");
  const imageModel = model("imageModel");
  if ((textModel && !MODEL_ID.test(textModel)) || (imageModel && !MODEL_ID.test(imageModel))) {
    return { error: "Model ids look like provider/model-name." };
  }
  if (!oneOf(AI_STYLES, input.style)) return { error: "Choose a writing style." };
  if (!oneOf(AI_DEPTHS, input.depth)) return { error: "Choose a length." };
  if (!oneOf(AI_LANGUAGES, input.language)) return { error: "Choose a language." };
  if (typeof input.webSearch !== "boolean") return { error: "Invalid AI settings." };
  const researchModel = model("researchModel");
  if (researchModel && researchModel !== NATIVE_RESEARCH && !MODEL_ID.test(researchModel)) {
    return { error: "Choose a research model." };
  }
  const inlineCitations = oneOf(INLINE_CITATIONS, input.inlineCitations) ? input.inlineCitations : "none";

  return {
    data: {
      textModel,
      imageModel,
      style: input.style,
      depth: input.depth,
      language: input.language,
      webSearch: input.webSearch,
      researchModel,
      inlineCitations,
    },
  };
}

type ModelRef = { id: string; free?: boolean };

/** Fallback text models, tried in order after the Settings → AI choice. */
export const DEFAULT_TEXT_MODELS = [
  "openai/gpt-5-mini",
  "google/gemini-3.1-flash-lite",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

export const DEFAULT_IMAGE_MODELS = [
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
];

/** Tool-calling models the Telegram agent tries when none is chosen. */
export const DEFAULT_AGENT_MODELS = [
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

/** The first preferred id that is available, else the first free model, else the first one. */
export function pickModel(models: ModelRef[], preferred: readonly string[]): string {
  for (const id of preferred) {
    if (id && models.some((model) => model.id === id)) return id;
  }
  return models.find((model) => model.free)?.id ?? models[0]?.id ?? "";
}
