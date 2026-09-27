"use client";

import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";

export type UploadedImage = {
  assetId: string;
  url: string;
  name: string;
};

type Props = {
  /** Route slug on the UploadThing file router: themeMedia | extensionMedia */
  endpoint: "themeMedia" | "extensionMedia";
  label: string;
  hint?: string;
  multiple?: boolean;
  max?: number;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
};

export default function ImageField({ endpoint, label, hint, multiple, max = 10, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (files) => {
      setError("");
      const uploaded = files.map((file) => ({
        assetId: String(file.serverData?.assetId ?? ""),
        url: file.ufsUrl,
        name: file.name,
      }));
      onChange(multiple ? [...value, ...uploaded].slice(0, max) : uploaded.slice(0, 1));
    },
    onUploadError: (message) => setError(message.message || "Upload failed."),
  });

  const room = multiple ? max - value.length : 1 - value.length;
  const full = room <= 0;

  return (
    <div className="wfield">
      <label htmlFor={`${endpoint}-${multiple ? "gallery" : "cover"}`}>{label}</label>

      {value.length > 0 ? (
        <ul className="wupload-grid">
          {value.map((image) => (
            <li key={image.assetId || image.url} className="wupload-item">
              {/* UploadThing returns arbitrary remote hosts, so a plain img keeps the host list clean. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.name} />
              <div className="wupload-meta">
                <span title={image.name}>{image.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item.url !== image.url))}
                  disabled={isUploading}
                  aria-label={`Remove ${image.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="wupload-actions">
        <input
          ref={inputRef}
          id={`${endpoint}-${multiple ? "gallery" : "cover"}`}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length === 0) return;
            if (files.length > room) {
              setError(`Only ${room} more file${room === 1 ? "" : "s"} can be added.`);
              return;
            }
            startUpload(files);
          }}
        />
        <button
          className="wbtn wbtn-ghost wbtn-upload"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || full}
        >
          {isUploading ? "Uploading…" : value.length > 0 ? (multiple ? "Add more" : "Replace") : "Choose image"}
        </button>
        {multiple ? <span className="wupload-count">{value.length} / {max}</span> : null}
      </div>

      {hint ? <p className="wfield-hint-block">{hint}</p> : null}
      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
