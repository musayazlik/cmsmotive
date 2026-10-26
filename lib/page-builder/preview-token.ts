import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring links that show a page draft in the preview route —
 * shareable with clients and colleagues who have no panel account (the same
 * pattern as lib/post-preview.ts). Signed with BETTER_AUTH_SECRET; changing
 * the secret invalidates every outstanding link. Bound to storeId for multi-tenant isolation.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(storeId: string, pageId: string, locale: string, expires: number): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`page-preview:${storeId}:${pageId}:${locale}:${expires}`).digest("base64url").slice(0, 32);
}

/** `/pb-preview/<id>?locale=…&t=…&exp=…`, valid for seven days. */
export function pagePreviewPath(storeId: string, pageId: string, locale: string): string {
  const expires = Date.now() + TTL_MS;
  return `/pb-preview/${pageId}?locale=${locale}&t=${sign(storeId, pageId, locale, expires)}&exp=${expires}`;
}

/** True when the token matches this store + page + locale and has not expired. */
export function isValidPagePreview(storeId: string, pageId: string, locale: string, token: unknown, expires: unknown): boolean {
  if (typeof token !== "string" || typeof expires !== "string") return false;
  const milliseconds = Number(expires);
  if (!Number.isFinite(milliseconds) || milliseconds < Date.now()) return false;
  const expected = Buffer.from(sign(storeId, pageId, locale, milliseconds));
  const presented = Buffer.from(token);
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}
