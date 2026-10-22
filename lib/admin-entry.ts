import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_ENTRY_COOKIE = "cmsmotive.admin-entry";
export const ADMIN_ENTRY_TTL = 20 * 60;

export function adminEntryConfigured(): boolean {
  return (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32;
}

function signature(payload: string, panelPath: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("A stable BETTER_AUTH_SECRET of at least 32 characters is required for a private admin entry.");
  return createHmac("sha256", secret).update(`${panelPath}:${payload}`).digest("hex");
}

/** This short-lived cookie proves knowledge of the entry URL, never identity or permission. */
export function issueAdminEntry(panelPath: string, now = Date.now()): string {
  const payload = `${Math.floor(now / 1000)}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload, panelPath)}`;
}

export function validAdminEntry(headers: Headers | undefined, panelPath: string, now = Date.now()): boolean {
  if (!headers || !adminEntryConfigured()) return false;
  const token = headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_ENTRY_COOKIE}=`))?.slice(ADMIN_ENTRY_COOKIE.length + 1);
  const match = token?.match(/^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const age = Math.floor(now / 1000) - Number(match[1]);
  if (age < 0 || age > ADMIN_ENTRY_TTL) return false;
  const expected = signature(`${match[1]}.${match[2]}`, panelPath);
  return timingSafeEqual(Buffer.from(match[3], "hex"), Buffer.from(expected, "hex"));
}
