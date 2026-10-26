"use client";

import { useEffect, useRef, useState } from "react";
import { uploadMediaFiles } from "@/lib/media-upload-client";
import { mediaKindOf, MAX_MEDIA_BYTES, type MediaEndpoint, type MediaKind, type UploadedMedia } from "@/lib/media-upload-shared";
import { optimizeAllForUpload } from "@/lib/webp";
import { useUploadSettings } from "./upload-settings";

export { mediaKindOf };
export type { MediaEndpoint, MediaKind, UploadedMedia };

/**
 * Uploads picked or dropped files to an UploadThing endpoint. Images are
 * re-encoded as WebP in the browser per the panel upload settings
 * (lib/webp.ts) before they leave; videos go up untouched. The endpoint
 * records every file as a MediaAsset, so uploads show up in the library.
 */
export function useOptimizedUpload(endpoint: MediaEndpoint, accept: MediaKind[], onUploaded: (files: UploadedMedia[]) => void) {
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const uploadSettings = useUploadSettings();
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  async function upload(files: File[]) {
    const accepted = files.filter((file) => {
      const kind = mediaKindOf(file.type);
      return kind !== null && accept.includes(kind);
    });
    if (accepted.length === 0) {
      setError(accept.includes("video") ? "Choose image or video files." : "Choose image files: PNG, JPG or WebP.");
      return;
    }
    setError("");
    setProgress(0);
    setPhase("optimizing");

    let optimized: File[];
    try {
      optimized = (await optimizeAllForUpload(accepted, uploadSettings)).map((entry) => entry.file);
    } catch {
      setPhase("idle");
      setError("The images could not be prepared for upload.");
      return;
    }

    const oversized = optimized.find((file) => !file.size || file.size > MAX_MEDIA_BYTES[mediaKindOf(file.type) ?? "image"]);
    if (oversized) {
      setPhase("idle");
      setError(`${oversized.name} is too large: images can be up to 8 MB, videos up to 64 MB.`);
      return;
    }

    setPhase("uploading");
    try {
      await uploadMediaFiles(endpoint, optimized, setProgress, (result) => onUploadedRef.current(result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
    } finally { setPhase("idle"); }
  }

  return {
    upload,
    busy: phase !== "idle",
    /** "Optimizing images…" / "Uploading 42%" while busy. */
    status: phase === "optimizing" ? "Optimizing images…" : phase === "uploading" ? `Uploading ${progress}%` : "",
    error,
    setError,
  };
}
