"use client";

import { useEffect, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { optimizeAllForUpload } from "@/lib/webp";
import { useUploadSettings } from "./upload-settings";

export type MediaEndpoint = "productMedia" | "catalogContent" | "blogMedia";
export type MediaKind = "image" | "video";

/** A file as it lands in the media library (MediaAsset). */
export type UploadedMedia = {
  assetId: string;
  url: string;
  name: string;
  mimeType: string;
  alt?: string | null;
};

/** Matches the limits of the upload endpoints (app/api/uploadthing/core.ts). */
const MAX_BYTES: Record<MediaKind, number> = { image: 8 * 1024 * 1024, video: 64 * 1024 * 1024 };

export const mediaKindOf = (type: string): MediaKind | null =>
  type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : null;

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

  const { startUpload } = useUploadThing(endpoint, {
    onUploadProgress: setProgress,
    onClientUploadComplete: (files) => {
      setPhase("idle");
      onUploadedRef.current(
        files.map((file) => ({
          assetId: String(file.serverData?.assetId ?? ""),
          url: file.ufsUrl,
          name: file.name,
          mimeType: file.type,
        })),
      );
    },
    onUploadError: (failure) => {
      setPhase("idle");
      setError(failure.message || "The upload failed.");
    },
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

    const oversized = optimized.find((file) => file.size > MAX_BYTES[mediaKindOf(file.type) ?? "image"]);
    if (oversized) {
      setPhase("idle");
      setError(`${oversized.name} is too large: images can be up to 8 MB, videos up to 64 MB.`);
      return;
    }

    setPhase("uploading");
    try {
      await startUpload(optimized);
    } catch {
      setPhase("idle");
      setError((current) => current || "The upload failed.");
    }
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
