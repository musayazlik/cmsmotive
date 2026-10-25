import { listExtensions } from "@/lib/catalog";
import { currentStoreId } from "@/lib/current-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/extensions: the public extension catalogue, in the order the home page and /extensions show it. */
export async function GET() {
  try {
    return Response.json({ extensions: await listExtensions(await currentStoreId()) });
  } catch (error) {
    console.error("extension catalogue unavailable", error);
    return Response.json({ error: "The extension catalogue is unavailable." }, { status: 503 });
  }
}
