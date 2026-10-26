import { z } from "zod";

export const MEDIA_ENDPOINTS = ["productMedia", "catalogContent", "blogMedia", "mediaLibrary"] as const;
export type MediaEndpoint = (typeof MEDIA_ENDPOINTS)[number];
export type MediaKind = "image" | "video";
export const MAX_MEDIA_BYTES = { image: 8 * 1024 * 1024, video: 64 * 1024 * 1024 };
export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg", "image/bmp": "bmp", "image/tiff": "tiff", "image/heic": "heic", "image/heif": "heif", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/mpeg": "mpeg", "video/ogg": "ogv", "video/x-matroska": "mkv", "video/x-msvideo": "avi",
};
export const mediaKindOf = (mime: string): MediaKind | null => mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : null;
export type UploadedMedia = { assetId: string; url: string; name: string; mimeType: string; alt?: string | null };
export const mediaUploadSchema = z.object({
  endpoint: z.enum(MEDIA_ENDPOINTS),
  fileName: z.string().min(1).max(255).refine((value) => !/[\\/]/.test(value) && [...value].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), "Invalid filename."),
  mimeType: z.string().refine((value) => Object.hasOwn(MEDIA_EXTENSIONS, value), "Choose a supported image or video format."),
  fileSize: z.number().int().min(1),
}).superRefine((input, ctx) => {
  const kind = mediaKindOf(input.mimeType);
  if (!kind || input.fileSize > MAX_MEDIA_BYTES[kind]) ctx.addIssue({ code: "custom", message: "Images can be up to 8 MB; videos up to 64 MB." });
  if (input.endpoint === "productMedia" && kind !== "image") ctx.addIssue({ code: "custom", message: "Product covers and galleries accept images only." });
});

export function r2MediaReference(fileKey: string) {
  const match = /^r2:\/\/([a-z0-9-]+)\/(media\/[A-Za-z0-9_-]+\/[a-f0-9-]+\.[a-z0-9]+)$/.exec(fileKey);
  return match ? { bucket: match[1], key: match[2] } : null;
}
export function r2MediaUrl(fileKey: string) {
  const ref = r2MediaReference(fileKey);
  if (!ref) throw new Error("Invalid R2 media reference.");
  return `/api/media/r2/${ref.bucket}/${ref.key}`;
}
export function mediaKeyFromUrl(url: string) {
  try {
    const path = new URL(url, "https://media.invalid").pathname;
    if (!path.startsWith("/api/media/r2/")) return null;
    const key = `r2://${path.slice("/api/media/r2/".length)}`;
    return r2MediaReference(key) ? key : null;
  } catch { return null; }
}
