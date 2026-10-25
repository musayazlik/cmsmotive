import { requireAdmin } from "@/lib/admin-guard";
import { DEFAULT_CHAT_MODELS, pickModel } from "@/lib/ai-settings-shared";
import { OpenRouterStatusError, chatCompletion, isOpenRouterConfigured, listTextAndImageModels } from "@/lib/openrouter";
import { panelStore } from "@/lib/panel-store";
import { getAiSettings } from "@/lib/settings";
import { supportChatRequest, supportSystemPrompt } from "@/lib/support-chat";
import { activityStep, trackActivity } from "@/lib/assistant-activity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const origin = request.headers.get("origin");
  // Host includes local store aliases and custom domains, unlike the server's
  // internal request URL behind some proxies.
  if (origin && (!URL.canParse(origin) || new URL(origin).host !== request.headers.get("host"))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isOpenRouterConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 160_000) return Response.json({ error: "invalid_request" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = supportChatRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    const store = await panelStore();
    return await trackActivity({ storeId: store.id, source: "chat", title: "Assistant reply" }, async () => {
      const settings = await getAiSettings(store.id);
      // The chat's own choice wins; without one the preferred list applies,
      // and a catalogue hiccup falls back to the static list instead of
      // failing the chat. The blog's text model is not silently reused here.
      const catalogue = await listTextAndImageModels().catch(() => null);
      const candidates = settings.chatModel
        ? [settings.chatModel]
        : [...new Set([pickModel(catalogue?.text ?? [], DEFAULT_CHAT_MODELS) || DEFAULT_CHAT_MODELS[0], ...DEFAULT_CHAT_MODELS])];
      if (candidates[0] === undefined) {
        await activityStep("No chat model is available.", { status: "failed", failed: true });
        return Response.json({ error: "unavailable" }, { status: 503 });
      }

      const { messages, language, pathname } = parsed.data;
      // A wrong model id only fails its own try; a rejected key fails every
      // try and short-circuits into the configuration message.
      let lastError: unknown = null;
      for (const model of candidates) {
        try {
          await activityStep(`Preparing a reply (${model})`);
          const { content } = await chatCompletion({
            model,
            system: supportSystemPrompt(language, pathname, store.name),
            history: messages.slice(0, -1),
            user: messages[messages.length - 1].content,
            maxTokens: 1600,
            timeoutMs: 45_000,
            signal: request.signal,
          });
          return Response.json({ content }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          if (request.signal.aborted) throw error;
          lastError = error;
          console.error(`assistant chat: ${model} failed`, error);
          if (error instanceof OpenRouterStatusError && [401, 402, 403].includes(error.status)) break;
        }
      }
      await activityStep("The reply could not be generated.", { status: "failed", failed: true });
      // Provider errors can contain request details; keep them out of the
      // response, but a rejected key or exhausted credit is a configuration
      // problem the admin can fix, not a transient hiccup.
      if (lastError instanceof OpenRouterStatusError && [401, 402, 403].includes(lastError.status)) {
        return Response.json({ error: "not_configured" }, { status: 503 });
      }
      return Response.json({ error: "unavailable" }, { status: 502 });
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("assistant chat failed", error);
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
