import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreRole, isStoreAdmin } from "./store-access";
import { currentStoreId } from "./current-store";
import { resolveRequestStore } from "./stores";
import { cache } from "react";
export const getPublicAccount = cache(async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true, role: true },
    });
    return user ? { ...user, role: await getStoreRole(session.user.id, await currentStoreId()) ?? "user" } : null;
  } catch {
    return null;
  }
});

export function hasPanelSessionFor(requestHeaders: Headers): Promise<boolean> {
  return (async () => {
    try {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (!session) return false;
      return isStoreAdmin(await getStoreRole(session.user.id, (await resolveRequestStore(requestHeaders)).store.id));
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
