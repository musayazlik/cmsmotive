"use client";

import { useEffect, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { useUploadSettings } from "@/app/panel/_components/upload-settings";
import { optimizeForUpload } from "@/lib/webp";
import type { CoverRef } from "../_lib";

type Props = {
  value: CoverRef | null;
  onChange: (cover: CoverRef | null) => void;
  /** Image assets already in the media library, newest first. */
  library: CoverRef[];
};

/**
 * Featured image picker for posts. Opens a dialog to pick from the media
 * library or upload a new file. Uploads go through the blogMedia endpoint
 * so the file also lands in MediaAsset; the form stores the asset id.
 */
export default function CoverField({ value, onChange, library }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assets, setAssets] = useState(library);
  const [optimizing, setOptimizing] = useState(false);
  const uploadSettings = useUploadSettings();

  useEffect(() => {
    const dialog = pickerRef.current;
    if (!dialog) return;
    if (pickerOpen && !dialog.open) dialog.showModal();
    if (!pickerOpen && dialog.open) dialog.close();
  }, [pickerOpen]);

  const { startUpload, isUploading } = useUploadThing("blogMedia", {
    onClientUploadComplete: (files) => {
      setError("");
      const file = files[0];
      if (file) {
        const cover: CoverRef = {
          assetId: String(file.serverData?.assetId ?? ""),
          url: file.ufsUrl,
          name: file.name,
        };
        setAssets((prev) =>
          cover.assetId && !prev.some((asset) => asset.assetId === cover.assetId) ? [cover, ...prev] : prev,
        );
        onChange(cover);
        setPickerOpen(false);
      }
    },
    onUploadError: (message) => setError(message.message || "The cover image could not be uploaded."),
  });

  const busy = isUploading || optimizing;

  function choose(asset: CoverRef) {
    onChange(asset);
    setPickerOpen(false);
  }

  return (
    <div className="wfield-card">
      <p className="wsection-label">Cover image</p>

      {value ? (
        <div className="wcover">
          {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts */}
          <img src={value.url} alt={value.name} />
          <div className="wcover-actions">
            <button type="button" className="wbtn wbtn-sm" onClick={() => setPickerOpen(true)} disabled={busy}>
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
          onClick={() => setPickerOpen(true)}
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

      <dialog
        ref={pickerRef}
        className="wdialog wdialog-wide"
        onClose={() => setPickerOpen(false)}
        onClick={(event) => {
          if (event.target === pickerRef.current) setPickerOpen(false);
        }}
      >
        <div className="wdialog-head">
          <div>
            <span className="wdialog-eyebrow">Blog / Cover image</span>
            <h2>Choose a cover image</h2>
          </div>
          <button type="button" className="wdialog-close" aria-label="Close" onClick={() => setPickerOpen(false)}>
            ×
          </button>
        </div>
        <div className="wdialog-body">
          <div className="wpick-toolbar">
            <p className="wtable-count">{assets.length} images in the media library</p>
            <button type="button" className="wbtn wbtn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? (optimizing ? "Optimizing…" : "Uploading…") : "Upload new image"}
            </button>
          </div>

          {assets.length === 0 ? (
            <p className="wmenu-empty">No images in the library yet — upload the first cover.</p>
          ) : (
            <div className="wpick-grid">
              {assets.map((asset) => (
                <button
                  key={asset.assetId}
                  type="button"
                  className={value?.assetId === asset.assetId ? "wpick-item is-current" : "wpick-item"}
                  title={asset.name}
                  onClick={() => choose(asset)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts */}
                  <img src={asset.url} alt={asset.name} />
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
