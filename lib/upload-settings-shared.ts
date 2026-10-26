/**
 * Client-safe upload settings contract shared by the panel context and
 * forms. Lives apart from lib/settings.ts so browser bundles never pull
 * in the database client.
 */

export type UploadSettings = {
  /** Re-encode image uploads as WebP in the browser before they leave. */
  convertWebp: boolean;
  /** WebP encoder quality, 40–100. */
  webpQuality: number;
  packageProvider: UploadProvider;
  imageProvider: UploadProvider;
  videoProvider: UploadProvider;
};

export const UPLOAD_PROVIDERS = ["uploadthing", "r2"] as const;
export type UploadProvider = (typeof UPLOAD_PROVIDERS)[number];
export const isUploadProvider = (value: unknown): value is UploadProvider => UPLOAD_PROVIDERS.includes(value as UploadProvider);
export const DEFAULT_UPLOAD_SETTINGS: UploadSettings = { convertWebp: true, webpQuality: 70, packageProvider: "uploadthing", imageProvider: "uploadthing", videoProvider: "uploadthing" };

export const WEBP_QUALITY_MIN = 40;
export const WEBP_QUALITY_MAX = 100;

export function validateUploadSettings(input: Record<string, unknown>): { data: UploadSettings } | { error: string } {
  if (typeof input.convertWebp !== "boolean") return { error: "Choose whether to convert images to WebP." };
  if (!Number.isInteger(input.webpQuality) || Number(input.webpQuality) < WEBP_QUALITY_MIN || Number(input.webpQuality) > WEBP_QUALITY_MAX) return { error: `Quality must be between ${WEBP_QUALITY_MIN} and ${WEBP_QUALITY_MAX}.` };
  if (!isUploadProvider(input.packageProvider) || !isUploadProvider(input.imageProvider) || !isUploadProvider(input.videoProvider)) return { error: "Choose UploadThing or Cloudflare R2 for each upload type." };
  return { data: { convertWebp: input.convertWebp, webpQuality: Number(input.webpQuality), packageProvider: input.packageProvider, imageProvider: input.imageProvider, videoProvider: input.videoProvider } };
}
