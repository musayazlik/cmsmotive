import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getStoreRole, isStoreAdmin } from "@/lib/store-access";
import { panelStore } from "@/lib/panel-store";
import { getAdminAccessSettings } from "@/lib/admin-access";

/** An authenticated account may learn its own destination; guests never receive the private entry. */
export async function GET() {
  const responseHeaders = { "Cache-Control": "private, no-store" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized." }, { status: 401, headers: responseHeaders });
  const role = await getStoreRole(session.user.id, (await panelStore()).id);
  const target = isStoreAdmin(role) ? (await getAdminAccessSettings()).panelPath : "/account";
  return Response.json({ target }, { headers: responseHeaders });
}
