"use client";

import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { useUploadSettings } from "@/app/panel/_components/upload-settings";
import { optimizeForUpload } from "@/lib/webp";
import type { CoverRef } from "../_lib";

type Props = {
  value: CoverRef | null;
  onChange: (cover: CoverRef | null) => void;
};

/**
 * Featured image picker for posts. Uploads through the blogMedia endpoint so
 * the file also lands in MediaAsset; the form stores the asset id on the post.
 */
export default function CoverField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const uploadSettings = useUploadSettings();

  const { startUpload, isUploading } = useUploadThing("blogMedia", {
    onClientUploadComplete: (files) => {
      setError("");
      const file = files[0];
      if (file) {
        onChange({
          assetId: String(file.serverData?.assetId ?? ""),
          url: file.ufsUrl,
          name: file.name,
        });
      }
    },
    onUploadError: (message) => setError(message.message || "The cover image could not be uploaded."),
  });

  const busy = isUploading || optimizing;

  return (
    <div className="wfield-card">
      <p className="wsection-label">Cover image</p>

      {value ? (
        <div className="wcover">
          {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts */}
          <img src={value.url} alt={value.name} />
          <div className="wcover-actions">
            <button type="button" className="wbtn wbtn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? "Working…" : "Replace"}
            </button>
            <button type="button" className="wbtn wbtn-sm wbtn-danger-ghost" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="wcover-empty"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (optimizing ? "Optimizing…" : "Uploading…") : "Choose a cover image"}
        </button>
      )}

      <p className="wfield-hint-block">Shown as the featured image on the post card and listings. Recommended 16:9, max 8 MB.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length === 0) return;
          setOptimizing(true);
          const optimized = await optimizeForUpload(files[0], uploadSettings);
          setOptimizing(false);
          startUpload([optimized.file]);
        }}
      />

      {error ? (
        <p className="wfield-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
