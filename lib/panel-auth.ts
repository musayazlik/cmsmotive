import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/admin-guard";
import { panelStore } from "./panel-store";
import { getStoreRole } from "./store-access";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { adminLoginPath } from "@/lib/admin-access-shared";

/**
 * Shared panel guard: redirects to the login page when signed out and keeps
 * non-admin accounts outside the administration routes. Returns the identity the
 * shell and pages need so the session is not re-read in every route.
 */
export async function requirePanelUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(adminLoginPath((await getAdminAccessSettings()).panelPath));

  const role = await getStoreRole(session.user.id, (await panelStore()).id);
  if (!isAdminRole(role)) notFound();

  return { id: session.user.id, name: session.user.name, email: session.user.email, role: role! };
}
