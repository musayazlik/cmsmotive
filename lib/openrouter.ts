/**
 * Server-side OpenRouter client. The API key never leaves the server: the
 * panel talks to /api/admin/ai/*, which calls these helpers. Text models are
 * listed separately from image models (output modality) so the dialog can
 * offer a dedicated picker for cover generation.
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterModel = {
  id: string;
  name: string;
  context: number | null;
  priceIn: number | null;
  priceOut: number | null;
  free: boolean;
};

function requireKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured.");
  return key;
}

function headers(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    // OpenRouter attribution headers; used for their dashboard rankings.
    "HTTP-Referer": "https://cmsmotive.de",
    "X-Title": "CMSMotive Panel",
  };
}

/** USD/token (a decimal string) → USD per 1M tokens; null when unknown. */
function perMillion(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed * 1_000_000;
}

type OpenRouterModelRow = {
  id: string;
  name: string;
  context_length?: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
};

let modelCache: { at: number; text: OpenRouterModel[]; image: OpenRouterModel[] } | null = null;
const MODEL_CACHE_MS = 60 * 60 * 1000;

/** Text and image model catalogues; cached in memory for an hour. */
export async function listTextAndImageModels(): Promise<{ text: OpenRouterModel[]; image: OpenRouterModel[] }> {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache;

  const response = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: headers(requireKey()),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`OpenRouter models request failed (${response.status}).`);

  const payload = (await response.json()) as { data?: OpenRouterModelRow[] };
  const text: OpenRouterModel[] = [];
  const image: OpenRouterModel[] = [];
  for (const row of payload.data ?? []) {
    const model: OpenRouterModel = {
      id: row.id,
      name: row.name,
      context: typeof row.context_length === "number" ? row.context_length : null,
      priceIn: perMillion(row.pricing?.prompt),
      priceOut: perMillion(row.pricing?.completion),
      free: perMillion(row.pricing?.prompt) === 0 && perMillion(row.pricing?.completion) === 0,
    };
    if (row.architecture?.output_modalities?.includes("image")) image.push(model);
    else text.push(model);
  }
  const byName = (a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name);
  text.sort(byName);
  image.sort(byName);

  modelCache = { at: Date.now(), text, image };
  return modelCache;
}

/** A web-search source the model actually grounded on (deduplicated by URL). */
export type ChatCitation = { url: string; title: string | null };

/** One chat completion; web search is OpenRouter's plugin, billed per result. */
export async function chatCompletion(options: {
  model: string;
  system: string;
  user: string;
  webSearch?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; citations: ChatCitation[] }> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: headers(requireKey()),
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      ...(options.webSearch ? { plugins: [{ id: "web", max_results: 5 }] } : {}),
    }),
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 180_000)])
      : AbortSignal.timeout(options.timeoutMs ?? 180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as {
    choices?: {
      message?: {
        content?: unknown;
        annotations?: { url_citation?: { url?: unknown; title?: unknown } }[];
      };
    }[];
  };
  const message = payload.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model returned an empty response.");
  }
  const citations: ChatCitation[] = [];
  const seen = new Set<string>();
  for (const annotation of message?.annotations ?? []) {
    const url = annotation.url_citation?.url;
    if (typeof url !== "string" || !url.startsWith("http") || seen.has(url)) continue;
    seen.add(url);
    const title = annotation.url_citation?.title;
    citations.push({
      url,
      title: typeof title === "string" && title.trim() ? title.trim() : null,
    });
  }
  return { content, citations };
}

/**
 * Image generation goes through chat completions with image output modality.
 * Returns a data URL (base64) the caller uploads to storage.
 */
export async function imageGeneration(options: { model: string; prompt: string; timeoutMs?: number; signal?: AbortSignal }): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: headers(requireKey()),
    body: JSON.stringify({
      model: options.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: options.prompt }],
    }),
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 180_000)])
      : AbortSignal.timeout(options.timeoutMs ?? 180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { images?: { image_url?: { url?: unknown } }[] } }[];
  };
  const url = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof url !== "string" || !url.startsWith("data:")) {
    throw new Error("The image model returned no image.");
  }
  return url;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
