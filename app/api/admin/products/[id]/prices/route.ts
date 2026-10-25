import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, savePrice } from "@/lib/product-admin";

export const runtime = "nodejs";

/** POST /api/admin/products/:id/prices — a new price of the product in the panel's store. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await savePrice((await panelStore()).id, (await context.params).id, null, body), 201);
}
