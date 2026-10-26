import { r2MediaStorage } from "./r2-media-storage";
export { r2MediaStorage } from "./r2-media-storage";
import { randomUUID } from "node:crypto";
import { r2Config } from "./package-storage-config";
import { getUploadSettings } from "./settings";
import { prisma } from "./prisma";
import { MEDIA_EXTENSIONS, mediaKindOf, mediaUploadSchema, r2MediaReference, r2MediaUrl } from "./media-upload-shared";


export function mediaObjectKey(storeId: string, mime: string) { return `media/${storeId}/${randomUUID()}.${MEDIA_EXTENSIONS[mime]}`; }

/** Server uploads (AI, MCP and Telegram) use the same store choices as browser uploads. */
export async function storeMediaFile(storeId: string, userId: string, file: File) {
  const parsed = mediaUploadSchema.safeParse({ endpoint: "mediaLibrary", fileName: file.name, fileSize: file.size, mimeType: file.type });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const settings = await getUploadSettings(storeId);
  const provider = mediaKindOf(file.type) === "video" ? settings.videoProvider : settings.imageProvider;
  let stored: { key: string; url: string };
  if (provider === "r2") {
    const { bucket } = r2Config();
    const key = mediaObjectKey(storeId, file.type);
    await r2MediaStorage().put(bucket, key, file.type, new Uint8Array(await file.arrayBuffer()));
    const reference = `r2://${bucket}/${key}`;
    stored = { key: reference, url: r2MediaUrl(reference) };
  } else {
    const { utapi } = await import("./utapi");
    const upload = await utapi.uploadFiles(file);
    if (upload.error) throw new Error(`UploadThing rejected the upload: ${upload.error.message}`);
    stored = { key: upload.data.key, url: upload.data.ufsUrl };
  }
  return prisma.mediaAsset.create({ data: { ...stored, storeId, uploadedById: userId, fileName: file.name, fileSize: file.size, mimeType: file.type }, select: { id: true, key: true, url: true, fileName: true, fileSize: true, mimeType: true, alt: true, width: true, height: true, createdAt: true } });
}

export async function deleteMediaFile(fileKey: string) {
  const ref = r2MediaReference(fileKey);
  if (ref) { await r2MediaStorage().remove(ref.bucket, ref.key); return; }
  if (fileKey.startsWith("r2://")) throw new Error("This is not a public media file.");
  const { utapi } = await import("./utapi");
  if (!(await utapi.deleteFiles(fileKey)).success) throw new Error("Storage could not delete the file.");
}
