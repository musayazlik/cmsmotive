import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { addStoreUser, listStoreUsers, storeUserErrorResponse } from "@/lib/store-users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await listStoreUsers((await panelStore()).id, session.user.id, {
      q: params.get("q") ?? "", role: params.get("role") ?? "", joinedFrom: params.get("joinedFrom") ?? "",
      page: Number(params.get("page")), pageSize: Number(params.get("pageSize")),
    }));
  } catch (error) { return storeUserErrorResponse(error); }
}

export async function POST(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const user = await addStoreUser((await panelStore()).id, session.user.id, body);
    return Response.json({ user }, { status: 201 });
  } catch (error) { return storeUserErrorResponse(error); }
}
