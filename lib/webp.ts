import type { UploadSettings } from "@/lib/upload-settings-shared";

export type OptimizedFile = {
  file: File;
  /** True when the file was re-encoded as WebP. */
  converted: boolean;
};

/** Formats that must pass through untouched. */
const PASSTHROUGH = new Set(["image/gif", "image/svg+xml"]);

function isWebpEncodable(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Re-encodes a raster image as WebP in the browser, per the panel upload
 * settings. Keeps the original when conversion is off, the type is
 * excluded (svg, gif, already-webp), the browser cannot encode WebP, or
 * the result would be larger than the source.
 */
export async function optimizeForUpload(file: File, settings: UploadSettings): Promise<OptimizedFile> {
  if (!settings.convertWebp) return { file, converted: false };
  if (!file.type.startsWith("image/") || PASSTHROUGH.has(file.type) || file.type === "image/webp") {
    return { file, converted: false };
  }

  try {
    if (!isWebpEncodable()) return { file, converted: false };
    // from-image bakes EXIF rotation into the pixels before re-encoding.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { file, converted: false };
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", settings.webpQuality / 100);
    });
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) {
      return { file, converted: false };
    }

    const name = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
    return { file: new File([blob], name, { type: "image/webp" }), converted: true };
  } catch {
    return { file, converted: false };
  }
}

export async function optimizeAllForUpload(files: File[], settings: UploadSettings): Promise<OptimizedFile[]> {
  return Promise.all(files.map((file) => optimizeForUpload(file, settings)));
}
