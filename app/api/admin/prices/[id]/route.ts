import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, deletePrice, savePrice } from "@/lib/product-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/prices/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const price = await prisma.price.findFirst({ where: { id, product: { storeId } }, select: { productId: true } });
  if (!price) return Response.json({ error: "Price not found." }, { status: 404 });
  return adminResponse(await savePrice(storeId, price.productId, id, body));
}

/** DELETE /api/admin/prices/:id — only prices that were never sold. */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  return adminResponse(await deletePrice((await panelStore()).id, (await context.params).id));
}
