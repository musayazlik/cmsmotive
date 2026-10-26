import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, saveDelivery } from "@/lib/product-admin";

export const runtime = "nodejs";

/** PUT /api/admin/products/:id/delivery — licence keys and the buyer note (Packages tab). */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await saveDelivery((await panelStore()).id, (await context.params).id, body), 200);
}
