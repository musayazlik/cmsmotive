import { requireAdmin } from "@/lib/admin-guard";
import { isOpenRouterConfigured, listTextAndImageModels } from "@/lib/openrouter";
import { getAiSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** GET /api/admin/ai/models — text and image model catalogues plus the Settings → AI defaults. */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  if (!isOpenRouterConfigured()) {
    return Response.json(
      { error: "OpenRouter is not configured. Add OPENROUTER_API_KEY to the environment." },
      { status: 503 },
    );
  }

  try {
    const [{ text, image }, defaults] = await Promise.all([listTextAndImageModels(), getAiSettings()]);
    return Response.json({ text, image, defaults });
  } catch (error) {
    console.error("ai models: list failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Model list failed." }, { status: 502 });
  }
}
