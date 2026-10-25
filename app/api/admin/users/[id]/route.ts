import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { removeStoreUser, updateStoreUser, storeUserErrorResponse } from "@/lib/store-users";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    return Response.json({ user: await updateStoreUser((await panelStore()).id, session.user.id, (await context.params).id, body) });
  } catch (error) { return storeUserErrorResponse(error); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  try {
    await removeStoreUser((await panelStore()).id, session.user.id, (await context.params).id);
    return Response.json({ ok: true });
  } catch (error) { return storeUserErrorResponse(error); }
}
