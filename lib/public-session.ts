import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * True when the visitor carries a panel session. The public chrome shows the
 * admin-panel link only then. Failures fall back to signed out — a broken
 * session check must never take a public page down.
 */
export async function hasPanelSession(): Promise<boolean> {
  try {
    return Boolean(await auth.api.getSession({ headers: await headers() }));
  } catch (error) {
    console.error("hasPanelSession failed", error);
    return false;
  }
}
