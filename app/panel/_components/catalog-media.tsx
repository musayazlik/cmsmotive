"use client";

import { useState, type DragEvent } from "react";
import { MAX_GALLERY } from "@/lib/catalog-guard";
import MediaPicker from "./media-picker";
import { useOptimizedUpload, type UploadedMedia } from "./use-optimized-upload";
/** An uploaded MediaAsset as the product form handles it. */
export type UploadedImage = {
  assetId: string;
  url: string;
  name: string;
};

type Endpoint = "productMedia";

const toImage = (item: UploadedMedia): UploadedImage => ({ assetId: item.assetId, url: item.url, name: item.name });

/** Highlights a drop target while files are dragged over it and hands the dropped files on. */
function useDropTarget(onFiles: (files: File[]) => void, disabled: boolean) {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    handlers: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (disabled || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5.2-5.2a1.5 1.5 0 0 0-2.1 0L5 19.5" />
    </svg>
  );
}

type CoverProps = {
  endpoint: Endpoint;
  value: UploadedImage | null;
  onChange: (next: UploadedImage | null) => void;
};

/** Cover image: chosen from the media library (or uploaded there), or dropped straight onto the field. */
export function CoverUpload({ endpoint, value, onChange }: CoverProps) {
  const [picking, setPicking] = useState(false);
  const { upload, error, busy, status } = useOptimizedUpload(endpoint, ["image"], (files) => {
    if (files[0]) onChange(toImage(files[0]));
  });
  const drop = useDropTarget((files) => upload(files.slice(0, 1)), busy);
  const browse = () => setPicking(true);

  return (
    <div className="wfield-card">
      <div className="wmedia-head">
        <p className="wsection-label">Cover image</p>
        <span className="wmedia-count">{value ? "1 / 1" : "0 / 1"}</span>
      </div>

      {value ? (
        <div className={drop.dragging ? "wcover is-dragging" : "wcover"} {...drop.handlers}>
          {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts */}
          <img src={value.url} alt={value.name} />
          <div className="wcover-actions">
            <span className="wcover-name" title={value.name}>
              {value.name}
            </span>
            <button type="button" className="wbtn wbtn-sm" onClick={browse} disabled={busy}>
              {busy ? status : "Replace"}
            </button>
            <button type="button" className="wbtn wbtn-sm wbtn-danger-ghost" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={drop.dragging ? "wdrop wdrop-cover is-dragging" : "wdrop wdrop-cover"}
          onClick={browse}
          disabled={busy}
          {...drop.handlers}
        >
          <ImageIcon />
          <strong>{busy ? status : "Choose a cover image"}</strong>
          <span>From the media library or a new upload · or drop a file here</span>
        </button>
      )}

      {error ? (
        <p className="wfield-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="wfield-hint-block">Shown on the catalogue card on the home page and the listing page. 16:9 works best.</p>

      <MediaPicker
        open={picking}
        title="Choose a cover image"
        kinds={["image"]}
        endpoint={endpoint}
        confirmLabel="Use as cover"
        onClose={() => setPicking(false)}
        onSelect={(items) => onChange(toImage(items[0]))}
      />
    </div>
  );
}

type GalleryProps = {
  endpoint: Endpoint;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
};

/** Ordered gallery: add from the media library (or upload there), drop files onto the grid, reorder with the arrows. */
export function GalleryUpload({ endpoint, value, onChange }: GalleryProps) {
  const [picking, setPicking] = useState(false);
  const room = MAX_GALLERY - value.length;
  const add = (images: UploadedImage[]) => {
    const fresh = images.filter((image) => !value.some((existing) => existing.assetId === image.assetId));
    onChange([...value, ...fresh].slice(0, MAX_GALLERY));
  };
  const { upload, error, setError, busy, status } = useOptimizedUpload(endpoint, ["image"], (files) => add(files.map(toImage)));

  function drop(files: File[]) {
    if (files.length > room) {
      setError(room === 0 ? `The gallery is full: ${MAX_GALLERY} images.` : `Only ${room} more image${room === 1 ? "" : "s"} fit in the gallery.`);
      return;
    }
    void upload(files);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...value];
    const [image] = next.splice(index, 1);
    next.splice(index + by, 0, image);
    onChange(next);
  }

  const target = useDropTarget(drop, busy || room === 0);
  const browse = () => setPicking(true);

  return (
    <div className="wfield-card">
      <div className="wmedia-head">
        <p className="wsection-label">Gallery</p>
        <span className="wmedia-count">
          {value.length} / {MAX_GALLERY}
        </span>
      </div>

      {value.length === 0 ? (
        <button
          type="button"
          className={target.dragging ? "wdrop is-dragging" : "wdrop"}
          onClick={browse}
          disabled={busy}
          {...target.handlers}
        >
          <ImageIcon />
          <strong>{busy ? status : "Add gallery images"}</strong>
          <span>Up to {MAX_GALLERY} images from the media library or new uploads · or drop files here</span>
        </button>
      ) : (
        <ol className={target.dragging ? "wgallery is-dragging" : "wgallery"} {...target.handlers}>
          {value.map((image, index) => (
            <li key={image.assetId || image.url} className="wgallery-item">
              {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts */}
              <img src={image.url} alt={image.name} loading="lazy" />
              <span className="wgallery-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="wgallery-foot">
                <span className="wgallery-name" title={image.name}>
                  {image.name}
                </span>
                <button
                  type="button"
                  className="wgallery-tool"
                  onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                  aria-label={`Move ${image.name} earlier`}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="wgallery-tool"
                  onClick={() => move(index, 1)}
                  disabled={busy || index === value.length - 1}
                  aria-label={`Move ${image.name} later`}
                >
                  →
                </button>
                <button
                  type="button"
                  className="wgallery-tool is-danger"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  disabled={busy}
                  aria-label={`Remove ${image.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
          {room > 0 ? (
            <li>
              <button type="button" className="wgallery-add" onClick={browse} disabled={busy}>
                <span aria-hidden="true">+</span>
                <strong>{busy ? status : "Add images"}</strong>
                <small>{room} left</small>
              </button>
            </li>
          ) : null}
        </ol>
      )}

      {error ? (
        <p className="wfield-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="wfield-hint-block">Images keep this order wherever the gallery is shown. Drop files onto the grid to upload, use the arrows to reorder.</p>

      <MediaPicker
        open={picking}
        title="Add to the gallery"
        kinds={["image"]}
        multiple
        max={room}
        taken={value.map((image) => image.assetId)}
        endpoint={endpoint}
        confirmLabel="Add to gallery"
        onClose={() => setPicking(false)}
        onSelect={(items) => add(items.map(toImage))}
      />
    </div>
  );
}
