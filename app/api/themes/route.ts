import { listThemes } from "@/lib/catalog";
import { currentStoreId } from "@/lib/current-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/themes: the public theme catalogue, in the order the home page and /themes show it. */
export async function GET() {
  try {
    return Response.json({ themes: await listThemes(await currentStoreId()) });
  } catch (error) {
    console.error("theme catalogue unavailable", error);
    return Response.json({ error: "The theme catalogue is unavailable." }, { status: 503 });
  }
}
