import { listThemes } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/themes: the public theme catalogue, in the order the home page and /themes show it. */
export async function GET() {
  try {
    return Response.json({ themes: await listThemes() });
  } catch (error) {
    console.error("theme catalogue unavailable", error);
    return Response.json({ error: "The theme catalogue is unavailable." }, { status: 503 });
  }
}
