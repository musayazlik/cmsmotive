import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/admin-guard";
import { cache } from "react";
export const getPublicAccount = cache(async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true, role: true },
    });
  } catch {
    return null;
  }
});

export function hasPanelSessionFor(requestHeaders: Headers): Promise<boolean> {
  return (async () => {
    try {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (!session) return false;
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      return isAdminRole(user?.role);
    } catch (error) {
      console.error("hasPanelSession failed", error);
      return false;
    }
  })();
}

/**
 * True when the visitor carries an administrator session. The public chrome shows the
 * admin-panel link only then. Failures fall back to signed out — a broken
 * session check must never take a public page down.
 */
export async function hasPanelSession(): Promise<boolean> {
  return hasPanelSessionFor(await headers());
}
