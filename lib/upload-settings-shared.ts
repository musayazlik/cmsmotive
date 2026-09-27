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
};

export const DEFAULT_UPLOAD_SETTINGS: UploadSettings = { convertWebp: true, webpQuality: 70 };

export const WEBP_QUALITY_MIN = 40;
export const WEBP_QUALITY_MAX = 100;
