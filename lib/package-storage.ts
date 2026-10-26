import { createHash } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Config } from "./package-storage-config";
import { parseR2FileKey, PACKAGE_UPLOAD_TTL } from "./package-upload";

export function r2Client(config = r2Config(), requestHandler?: S3ClientConfig["requestHandler"]) {
  const client = new S3Client({
    region: "auto", endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    ...(requestHandler ? { requestHandler } : {}),
  });
  // The SDK adds required CRC32 headers to bucket XML writes even with WHEN_REQUIRED.
  // R2 does not support those headers on CORS/lifecycle writes; send Content-MD5 instead.
  client.middlewareStack.add((next, context) => async (args) => {
    if (["PutBucketCorsCommand", "PutBucketLifecycleConfigurationCommand"].includes(context.commandName ?? "")) {
      const request = args.request as { headers: Record<string, string>; body: string | Uint8Array };
      for (const name of Object.keys(request.headers)) {
        if (name === "x-amz-sdk-checksum-algorithm" || name.startsWith("x-amz-checksum-")) delete request.headers[name];
      }
      request.headers["content-md5"] = createHash("md5").update(request.body).digest("base64");
    }
    return next(args);
  }, { name: "r2BucketXmlChecksums", step: "build", priority: "low" });
  return client;
}

let sharedPackageClient: S3Client | undefined;
export function sharedR2Client() { return sharedPackageClient ??= r2Client(); }

export function r2PackageStorage(client = sharedR2Client()) {
  return {
    uploadUrl: (bucket: string, key: string, size: number) => getSignedUrl(client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "application/zip", ContentLength: size }),
      { expiresIn: PACKAGE_UPLOAD_TTL, signableHeaders: new Set(["content-type", "content-length"]) }),
    inspect: (bucket: string, key: string) => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    // The browser can only write to staging. Copies used by releases have no signed PUT URL.
    promote: (bucket: string, staging: string, key: string, etag: string) => client.send(new CopyObjectCommand({
      Bucket: bucket, Key: key, CopySource: `${bucket}/${staging.split("/").map(encodeURIComponent).join("/")}`,
      CopySourceIfMatch: etag, MetadataDirective: "REPLACE", ContentType: "application/zip", ContentDisposition: "attachment",
    })),
    remove: (bucket: string, key: string) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    downloadUrl: (bucket: string, key: string, fileName: string) => getSignedUrl(client,
      new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}` }),
      { expiresIn: 60 }),
  };
}

export async function packageDownloadUrl(fileKey: string, fileName: string) {
  const reference = parseR2FileKey(fileKey);
  if (reference) return r2PackageStorage().downloadUrl(reference.bucket, reference.key, fileName);
  const { utapi } = await import("./utapi");
  return (await utapi.generateSignedURL(fileKey, { expiresIn: 60 })).ufsUrl;
}

export async function deletePackageFile(fileKey: string) {
  const reference = parseR2FileKey(fileKey);
  if (reference) { await r2PackageStorage().remove(reference.bucket, reference.key); return; }
  const { utapi } = await import("./utapi");
  const result = await utapi.deleteFiles(fileKey);
  if (!result.success) throw new Error("UploadThing could not delete the package.");
}
