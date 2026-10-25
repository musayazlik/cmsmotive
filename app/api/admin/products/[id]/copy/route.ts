import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, copyProductToStore } from "@/lib/product-admin";

export const runtime = "nodejs";

/** POST /api/admin/products/:id/copy — a draft copy in another store. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await copyProductToStore((await panelStore()).id, (await context.params).id, String((body as { storeId?: unknown }).storeId ?? "")), 201);
}
