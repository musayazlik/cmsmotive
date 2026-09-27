import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Shared panel guard: redirects to the login page when signed out and keeps
 * non-admin accounts on the public-facing overview. Returns the identity the
 * shell and pages need so the session is not re-read in every route.
 */
export async function requirePanelUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") redirect("/panel");

  return { id: session.user.id, name: session.user.name, email: session.user.email, role: user.role };
}
