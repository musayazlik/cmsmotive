import { requireAdmin } from "@/lib/admin-guard";
import { getOpenRouterKeyUsage, isOpenRouterConfigured } from "@/lib/openrouter";

export const runtime = "nodejs";

/** GET /api/admin/ai/usage — credit balance and usage counters for the server key. */
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
    return Response.json(await getOpenRouterKeyUsage());
  } catch (error) {
    console.error("ai usage: OpenRouter key usage request failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Usage data could not be loaded." }, { status: 502 });
  }
}