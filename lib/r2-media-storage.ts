import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sharedR2Client } from "./package-storage";

export function r2MediaStorage(client: S3Client = sharedR2Client()) {
  return {
    uploadUrl: (bucket: string, key: string, type: string, size: number) => getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: `staging/${key}`, ContentType: type, ContentLength: size }), { expiresIn: 900, signableHeaders: new Set(["content-type", "content-length"]) }),
    inspect: (bucket: string, key: string) => client.send(new HeadObjectCommand({ Bucket: bucket, Key: `staging/${key}` })),
    promote: (bucket: string, key: string, type: string, etag: string) => client.send(new CopyObjectCommand({ Bucket: bucket, Key: key, CopySource: `${bucket}/staging/${key}`, CopySourceIfMatch: etag, MetadataDirective: "REPLACE", ContentType: type })),
    put: (bucket: string, key: string, type: string, body: Uint8Array) => client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: type })),
    read: (bucket: string, key: string, range?: string) => client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(range ? { Range: range } : {}) })),
    remove: (bucket: string, key: string) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    signedUrl: (bucket: string, key: string) => getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 }),
  };
}

