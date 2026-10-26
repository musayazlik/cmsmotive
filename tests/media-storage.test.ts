import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_UPLOAD_SETTINGS, validateUploadSettings } from "../lib/upload-settings-shared";
import { mediaKeyFromUrl, mediaUploadSchema, r2MediaReference, r2MediaUrl } from "../lib/media-upload-shared";
import { issueMediaReceipt, readMediaReceipt, MEDIA_UPLOAD_TTL } from "../lib/media-upload-receipt";
import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { r2MediaStorage } from "../lib/r2-media-storage";

test("upload settings validate each destination independently and preserve image optimization", () => {
  assert.deepEqual(validateUploadSettings({ ...DEFAULT_UPLOAD_SETTINGS, packageProvider: "r2", videoProvider: "r2" }), { data: { ...DEFAULT_UPLOAD_SETTINGS, packageProvider: "r2", videoProvider: "r2" } });
  for (const field of ["packageProvider", "imageProvider", "videoProvider"]) assert.ok("error" in validateUploadSettings({ ...DEFAULT_UPLOAD_SETTINGS, [field]: "public" }));
  assert.ok("error" in validateUploadSettings({ ...DEFAULT_UPLOAD_SETTINGS, convertWebp: "true" }));
  for (const webpQuality of [39, 101, 70.5]) assert.ok("error" in validateUploadSettings({ ...DEFAULT_UPLOAD_SETTINGS, webpQuality }));
});

test("media limits distinguish images, videos and image-only product covers", () => {
  const image = { endpoint: "mediaLibrary", fileName: "cover.svg", fileSize: 100, mimeType: "image/svg+xml" };
  assert.ok(mediaUploadSchema.safeParse(image).success);
  assert.ok(mediaUploadSchema.safeParse({ ...image, fileName: "clip.mp4", mimeType: "video/mp4", fileSize: 64 * 1024 * 1024 }).success);
  for (const input of [
    { ...image, fileSize: 0 }, { ...image, fileSize: 8 * 1024 * 1024 + 1 }, { ...image, fileName: "../cover.svg" },
    { ...image, mimeType: "text/html" }, { ...image, mimeType: "application/zip" },
    { ...image, mimeType: "video/mp4", endpoint: "productMedia" }, { ...image, mimeType: "video/mp4", fileSize: 64 * 1024 * 1024 + 1 },
  ]) assert.ok(!mediaUploadSchema.safeParse(input).success);
});

test("stable media URLs never accept private package keys, staging objects or traversal", () => {
  const key = "r2://media-bucket/media/store/1234-abcd.png";
  const url = r2MediaUrl(key);
  assert.equal(mediaKeyFromUrl(url), key);
  assert.equal(mediaKeyFromUrl(`https://cmsmotive.com${url}`), key);
  for (const fileKey of ["r2://media-bucket/packages/store/product/1234.zip", "r2://media-bucket/staging/media/store/1234.png", "r2://media-bucket/media/../1234.png", "uploadthing-key"]) {
    assert.equal(r2MediaReference(fileKey), null);
    assert.throws(() => r2MediaUrl(fileKey));
  }
  assert.equal(mediaKeyFromUrl("/api/media/r2/bucket/packages/store/product/1234.zip"), null);
});

test("media upload completion is bound to the selected file, user, store and expiry", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-only-media-secret-with-over-32-characters";
  try {
    const now = Date.now();
    const actor = { userId: "admin", storeId: "store" };
    const claims = { ...actor, endpoint: "blogMedia" as const, fileName: "cover.png", fileSize: 100, mimeType: "image/png", bucket: "media-bucket", key: "media/store/1234-abcd.png" };
    const receipt = issueMediaReceipt(claims, now);
    assert.ok(readMediaReceipt(receipt, actor, now));
    assert.equal(readMediaReceipt(receipt, { ...actor, storeId: "other-store" }, now), null);
    assert.equal(readMediaReceipt(receipt, { ...actor, userId: "other-admin" }, now), null);
    assert.equal(readMediaReceipt(receipt, actor, now + MEDIA_UPLOAD_TTL * 1000), null);
    assert.equal(readMediaReceipt(receipt, actor, now - 1000), null);
    const [, signature] = receipt.split(".");
    const modified = Buffer.from(JSON.stringify({ ...claims, mimeType: "video/mp4", expiresAt: now + MEDIA_UPLOAD_TTL * 1000 })).toString("base64url");
    assert.equal(readMediaReceipt(`${modified}.${signature}`, actor, now), null);
    assert.equal(readMediaReceipt(`${receipt}.suffix`, actor, now), null);
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});

test("R2 media uploads sign MIME and size, copy to a final media key, and support video byte ranges", async () => {
  const requests: { method: string; path: string; headers: Record<string, string> }[] = [];
  const client = new S3Client({ region: "auto", endpoint: "https://fixture.r2.cloudflarestorage.com", credentials: { accessKeyId: "fixture", secretAccessKey: "fixture" }, requestChecksumCalculation: "WHEN_REQUIRED", requestHandler: { handle: async (request: { method: string; path: string; headers: Record<string, string> }) => {
    requests.push(request);
    return { response: { statusCode: request.method === "GET" ? 206 : 200, headers: { "content-type": "video/mp4", "content-range": "bytes 0-3/12", "content-length": "4" }, body: request.method === "PUT" ? Buffer.from('<CopyObjectResult><ETag>"fixture"</ETag></CopyObjectResult>') : Readable.from([Buffer.from([1, 2, 3, 4])]) } };
  } } });
  try {
    const storage = r2MediaStorage(client);
    const put = new URL(await storage.uploadUrl("media-bucket", "media/store/1234.mp4", "video/mp4", 12));
    assert.ok(put.pathname.includes("staging/media/store/1234.mp4"));
    assert.equal(put.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
    await storage.promote("media-bucket", "media/store/1234.mp4", "video/mp4", '"fixture"');
    assert.equal(requests[0].headers["x-amz-copy-source-if-match"], '"fixture"');
    assert.ok(requests[0].path.includes("media/store/1234.mp4"));
    const ranged = await storage.read("media-bucket", "media/store/1234.mp4", "bytes=0-3");
    assert.equal(requests[1].headers.range, "bytes=0-3");
    assert.equal(ranged.ContentRange, "bytes 0-3/12");
    assert.deepEqual(await ranged.Body?.transformToByteArray(), new Uint8Array([1, 2, 3, 4]));
  } finally { client.destroy(); }
});
