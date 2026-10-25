import { requireAdmin } from "@/lib/admin-guard";
import { adminResponse, deleteProductType, saveProductType } from "@/lib/product-admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/product-types/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await saveProductType((await context.params).id, body));
}

/** DELETE /api/admin/product-types/:id — only types no product uses. */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  return adminResponse(await deleteProductType((await context.params).id));
}
