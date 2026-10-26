import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { mediaUploadSchema } from "./media-upload-shared";

export const MEDIA_UPLOAD_TTL = 15 * 60;
const schema = mediaUploadSchema.and(z.object({ userId: z.string().min(1), storeId: z.string().min(1), bucket: z.string().min(3), key: z.string().regex(/^media\/[A-Za-z0-9_-]+\/[a-f0-9-]+\.[a-z0-9]+$/), expiresAt: z.number().int() }));
export type MediaReceipt = z.infer<typeof schema>;
function sign(body: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Set BETTER_AUTH_SECRET to at least 32 characters before uploading media.");
  return createHmac("sha256", secret).update(`media-upload:${body}`).digest();
}
export function issueMediaReceipt(input: Omit<MediaReceipt, "expiresAt">, now = Date.now()) {
  const body = Buffer.from(JSON.stringify(schema.parse({ ...input, expiresAt: now + MEDIA_UPLOAD_TTL * 1000 }))).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}
export function readMediaReceipt(token: string, actor: { userId: string; storeId: string }, now = Date.now()): MediaReceipt | null {
  if (token.length > 8192) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = sign(body), actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = schema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    return parsed.userId === actor.userId && parsed.storeId === actor.storeId && parsed.expiresAt > now && parsed.expiresAt <= now + MEDIA_UPLOAD_TTL * 1000 ? parsed : null;
  } catch { return null; }
}
