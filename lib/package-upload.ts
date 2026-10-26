import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MAX_PACKAGE_BYTES } from "./package-storage-config";

export const PACKAGE_UPLOAD_TTL = 15 * 60;
export const packageUploadSchema = z.object({
  productId: z.string().min(1).max(120),
  version: z.string().regex(/^[a-zA-Z0-9.+-]{1,40}$/),
  fileName: z.string().min(5).max(255).regex(/^[^/\\\x00-\x1f\x7f]+\.zip$/i, "Choose a .zip file without path characters."),
  fileSize: z.number().int().min(1).max(MAX_PACKAGE_BYTES),
});
const receiptSchema = packageUploadSchema.extend({
  userId: z.string().min(1), storeId: z.string().min(1),
  bucket: z.string().min(3), key: z.string().startsWith("staging/"),
  codeLicense: z.string().trim().min(1), expiresAt: z.number().int(),
});
export const packageRequestSchema = z.discriminatedUnion("action", [
  packageUploadSchema.extend({ action: z.literal("prepare") }),
  z.object({ action: z.literal("complete"), receipt: z.string().min(1).max(8192) }),
]);
export type PackageUploadRequest = z.infer<typeof packageRequestSchema>;
export type PackageUploadReceipt = z.infer<typeof receiptSchema>;

function secret() {
  const key = process.env.BETTER_AUTH_SECRET;
  if (!key || key.length < 32) throw new Error("Set BETTER_AUTH_SECRET to at least 32 characters before uploading packages.");
  return key;
}

export function issuePackageReceipt(input: Omit<PackageUploadReceipt, "expiresAt">, now = Date.now()) {
  const payload = receiptSchema.parse({ ...input, expiresAt: now + PACKAGE_UPLOAD_TTL * 1000 });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(`package-upload:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function readPackageReceipt(token: string, actor: { userId: string; storeId: string }, now = Date.now()): PackageUploadReceipt | null {
  if (token.length > 8192) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", secret()).update(`package-upload:${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = receiptSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (parsed.userId !== actor.userId || parsed.storeId !== actor.storeId || parsed.expiresAt <= now || parsed.expiresAt > now + PACKAGE_UPLOAD_TTL * 1000) return null;
    return parsed;
  } catch { return null; }
}

/** Persist the provider and bucket in the existing opaque fileKey; old UploadThing keys remain valid. */
export function r2FileKey(bucket: string, key: string) { return `r2://${bucket}/${key}`; }
export function parseR2FileKey(fileKey: string) {
  if (!fileKey.startsWith("r2://")) return null;
  const match = /^r2:\/\/([a-z0-9-]+)\/(packages\/[^\s]+)$/.exec(fileKey);
  if (!match) throw new Error("Invalid R2 package reference.");
  return { bucket: match[1], key: match[2] };
}
export function finalPackageKey(stagingKey: string) {
  if (!/^staging\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.zip$/.test(stagingKey)) throw new Error("Invalid package upload path.");
  return stagingKey.replace(/^staging\//, "packages/");
}
