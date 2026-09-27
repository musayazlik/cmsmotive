import { requireAdmin } from "@/lib/admin-guard";
import { isOpenRouterConfigured, listTextAndImageModels } from "@/lib/openrouter";

export const runtime = "nodejs";

/** GET /api/admin/ai/models — text and image model catalogues for the dialog. */
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
    const { text, image } = await listTextAndImageModels();
    return Response.json({ text, image });
  } catch (error) {
    console.error("ai models: list failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Model list failed." }, { status: 502 });
  }
}
