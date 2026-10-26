/**
 * Shared types and formatters for the media library. The page joins two
 * sources — the UploadThing bucket (source of truth for what exists in
 * storage) and the MediaAsset table (tracking, urls, usage) — into one
 * row list the client table can filter without further server round trips.
 */

export type MediaSource = "tracked" | "untracked" | "missing";

export type MediaUsage = {
  /** Product and post covers. */
  products: number;
  posts: number;
  gallery: number;
  /** Placed inside post bodies, product descriptions and builder pages. */
  embedded: { posts: number; products: number; pages: number };
};

export type MediaRow = {
  /** UploadThing file id; falls back to the asset id for missing files. */
  id: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
  /** UploadThing pipeline status, e.g. "Uploaded". */
  status: string;
  source: MediaSource;
  usage: MediaUsage;
  uploader: string | null;
};

export type MediaUsageInfo = {
  filesUploaded: number;
  totalBytes: number;
  limitBytes: number;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value >= 100 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function mediaKind(mimeType: string): "image" | "video" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "other";
}

/**
 * Untracked files only exist in UploadThing, which reports no mime type —
 * the extension is close enough for the type filter and thumbnails.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export function guessMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "";
}

/** Raster images render as thumbnails; svg and everything else get a tile. */
export function isRasterImage(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
}

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "dmg", "iso"]);

export type MediaTile = {
  /** Short label shown inside the tile, e.g. "PDF", "ZIP", "SVG". */
  label: string;
  tone: "pdf" | "archive" | "file" | "video";
};

/**
 * Default visual for files without a raster preview: a colored tile with
 * the extension so svg, pdf and archive files stay recognizable at a glance.
 */
export function fileTile(fileName: string, mimeType: string): MediaTile {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const label = (extension || "file").slice(0, 4).toUpperCase();

  if (mimeType === "application/pdf" || extension === "pdf") return { label, tone: "pdf" };
  if (mimeType.startsWith("video/") || MIME_BY_EXTENSION[extension]?.startsWith("video/")) {
    return { label, tone: "video" };
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) return { label, tone: "archive" };
  return { label, tone: "file" };
}

export const SOURCE_LABELS: Record<MediaSource, string> = {
  tracked: "Tracked",
  untracked: "Untracked",
  missing: "Missing",
};

export const SOURCE_BADGES: Record<MediaSource, string> = {
  tracked: "wbadge wbadge-verified",
  untracked: "wbadge wbadge-pending",
  missing: "wbadge wbadge-missing",
};

/** "Used in" summary for the table cell; empty string when orphaned. */
export function usageSummary(usage: MediaUsage): string[] {
  const parts: string[] = [];
  if (usage.posts > 0) parts.push(`Post cover ×${usage.posts}`);
  if (usage.embedded.posts > 0) parts.push(`In posts ×${usage.embedded.posts}`);
  if (usage.products > 0) parts.push(`Product cover ×${usage.products}`);
  if (usage.gallery > 0) parts.push(`Galleries ×${usage.gallery}`);
  if (usage.embedded.products > 0) parts.push(`In product pages ×${usage.embedded.products}`);
  if (usage.embedded.pages > 0) parts.push(`In builder pages ×${usage.embedded.pages}`);
  return parts;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
