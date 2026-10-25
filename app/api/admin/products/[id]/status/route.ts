import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, setProductStatus } from "@/lib/product-admin";

export const runtime = "nodejs";

/** PUT /api/admin/products/:id/status — draft, preview or published; publishing needs every ready-to-sell item. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await setProductStatus((await panelStore()).id, (await context.params).id, (body as { status?: unknown }).status), 200);
}
