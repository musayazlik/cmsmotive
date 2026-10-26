/**
 * UploadThing file key behind an avatar URL (`https://<host>/f/<key>`); Google
 * profile URLs and anything else returns null so only our own uploads are deleted.
 */
export function avatarFileKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.pathname.startsWith("/f/")) return null;
    const key = decodeURIComponent(parsed.pathname.slice(3));
    return /^[A-Za-z0-9._/-]+$/.test(key) && key.length <= 512 ? key : null;
  } catch {
    return null;
  }
}
