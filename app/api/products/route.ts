import { listProducts } from "@/lib/catalog";
import { currentStoreId } from "@/lib/current-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/products?type=<key>: the store's public catalogue, in the order its pages show it. */
export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type")?.trim() || undefined;
  try {
    return Response.json({ products: await listProducts(await currentStoreId(), type) });
  } catch (error) {
    console.error("product catalogue unavailable", error);
    return Response.json({ error: "The product catalogue is unavailable." }, { status: 503 });
  }
}
