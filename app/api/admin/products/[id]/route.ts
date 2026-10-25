import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, deleteProduct, saveProduct } from "@/lib/product-admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/products/:id — the General tab: content, media and card fields. */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await saveProduct((await panelStore()).id, (await context.params).id, body));
}

/** DELETE /api/admin/products/:id — only products without sales. */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  return adminResponse(await deleteProduct((await panelStore()).id, (await context.params).id));
}
