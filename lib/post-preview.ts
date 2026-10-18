import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring links that show an unpublished post on its public page —
 * sent by the Telegram bot so a draft can be read on a phone without signing
 * in to the panel. Signed with BETTER_AUTH_SECRET; changing the secret
 * invalidates every outstanding link.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(postId: string, expires: number): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`post-preview:${postId}:${expires}`).digest("base64url").slice(0, 32);
}

/** `/blog/<slug>?preview=…&exp=…`, valid for seven days. */
export function postPreviewPath(postId: string, slug: string): string {
  const expires = Date.now() + TTL_MS;
  return `/blog/${slug}?preview=${sign(postId, expires)}&exp=${expires}`;
}

export function isValidPostPreview(postId: string, token: unknown, expires: unknown): boolean {
  if (typeof token !== "string" || typeof expires !== "string") return false;
  const at = Number(expires);
  if (!Number.isSafeInteger(at) || at < Date.now()) return false;
  try {
    const expected = Buffer.from(sign(postId, at));
    const actual = Buffer.from(token);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
