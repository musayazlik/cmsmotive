"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { mediaKindOf, useOptimizedUpload, type MediaEndpoint, type MediaKind, type UploadedMedia } from "./use-optimized-upload";

/** A library row as /api/admin/media returns it; fresh uploads only carry the UploadedMedia fields. */
type LibraryItem = UploadedMedia & { size?: number; width?: number | null; height?: number | null; createdAt?: string };

type Props = {
  open: boolean;
  title: string;
  /** Kinds the picker lists and accepts; with both, tabs switch between them. */
  kinds: MediaKind[];
  initialKind?: MediaKind;
  multiple?: boolean;
  /** Most items that can be picked at once, e.g. the room left in a gallery. */
  max?: number;
  /** Assets already in place (such as gallery images): listed, but not selectable. */
  taken?: string[];
  /** Where new uploads go. */
  endpoint: MediaEndpoint;
  confirmLabel?: string;
  onClose: () => void;
  onSelect: (items: UploadedMedia[]) => void;
};

const KIND_LABELS: Record<MediaKind, { tab: string; one: string; plural: string; upload: string }> = {
  image: { tab: "Images", one: "image", plural: "images", upload: "Upload images" },
  video: { tab: "Videos", one: "video", plural: "videos", upload: "Upload videos" },
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "image/webp" → "WEBP", "video/quicktime" → "MOV". */
function formatLabel(mimeType: string) {
  const subtype = mimeType.split("/")[1] ?? "";
  return ({ jpeg: "JPG", quicktime: "MOV", "svg+xml": "SVG" } as Record<string, string>)[subtype] ?? subtype.toUpperCase();
}

const formatDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/**
 * Media library dialog: pick images or videos that are already uploaded, or
 * upload new ones (images are optimized to WebP first). New uploads join
 * the list already selected. Rendered into <body> so it never nests inside
 * the page's form.
 */
export default function MediaPicker({
  open, title, kinds, initialKind, multiple = false, max, taken = [], endpoint, confirmLabel = "Insert", onClose, onSelect,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<MediaKind>(initialKind ?? kinds[0]);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<UploadedMedia[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  // Every opening starts fresh on the requested tab.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind ?? kinds[0]);
    setSelected([]);
    setQuery("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    async (nextPage: number) => {
      const request = ++requestId.current;
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ kind, page: String(nextPage) });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/admin/media?${params.toString()}`);
        const data = await response.json();
        if (request !== requestId.current) return;
        if (!response.ok) {
          setLoadError(data.error ?? "The media library could not be loaded.");
          return;
        }
        setItems((previous) => (nextPage === 1 ? data.items : [...previous, ...data.items]));
        setTotal(data.total);
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      } catch {
        if (request === requestId.current) setLoadError("Could not reach the server.");
      } finally {
        if (request === requestId.current) setLoading(false);
      }
    },
    [kind, query],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => load(1), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, load, query]);

  const room = max === undefined ? Infinity : max;

  const uploader = useOptimizedUpload(endpoint, [kind], (files) => {
    const fresh = files.filter((file) => mediaKindOf(file.mimeType) === kind);
    setItems((previous) => [...fresh, ...previous.filter((item) => !fresh.some((file) => file.assetId === item.assetId))]);
    setTotal((count) => count + fresh.length);
    setSelected((previous) => (multiple ? [...previous, ...fresh].slice(0, room) : fresh.slice(-1)));
  });

  function toggle(item: UploadedMedia) {
    if (taken.includes(item.assetId)) return;
    setSelected((previous) => {
      const picked = previous.some((entry) => entry.assetId === item.assetId);
      if (!multiple) return picked ? [] : [item];
      if (picked) return previous.filter((entry) => entry.assetId !== item.assetId);
      return previous.length >= room ? previous : [...previous, item];
    });
  }

  function confirm(list: UploadedMedia[] = selected) {
    if (list.length === 0) return;
    onSelect(list);
    onClose();
  }

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) void uploader.upload(multiple ? files : files.slice(0, 1));
    },
  };

  const labels = KIND_LABELS[kind];
  const error = uploader.error || loadError;
  const last = selected[selected.length - 1];
  const focus: LibraryItem | undefined = last ? (items.find((item) => item.assetId === last.assetId) ?? last) : undefined;
  const footNote =
    selected.length > 0
      ? `${selected.length} selected${max !== undefined && multiple ? ` · ${Math.max(0, max - selected.length)} more allowed` : ""}`
      : multiple
        ? "Select one or more, in the order you want them"
        : "Select one · double-click to use it right away";

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="wdialog wlib-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Media library</span>
          <h2>{title}</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="wdialog-body wlib-body" {...dropHandlers}>
        <div className="wlib-toolbar">
          {kinds.length > 1 ? (
            <div className="wlib-tabs" role="tablist" aria-label="Media type">
              {kinds.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={kind === option}
                  className={kind === option ? "wlib-tab is-active" : "wlib-tab"}
                  onClick={() => {
                    setKind(option);
                    setSelected([]);
                  }}
                >
                  {KIND_LABELS[option].tab}
                </button>
              ))}
            </div>
          ) : null}
          <label className="wlib-search">
            <SearchIcon />
            <span className="visually-hidden">Search {labels.plural}</span>
            <input
              type="search"
              value={query}
              placeholder={`Search ${labels.plural} by name or alt text`}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </label>
          <span className="wlib-total">
            {total} {total === 1 ? labels.one : labels.plural}
          </span>
          <button type="button" className="wbtn wbtn-primary" onClick={() => fileInput.current?.click()} disabled={uploader.busy}>
            {uploader.busy ? uploader.status : labels.upload}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={`${kind}/*`}
            multiple={multiple}
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length > 0) void uploader.upload(files);
            }}
          />
        </div>

        {error ? (
          <p className="wdialog-error wlib-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wlib-layout">
          <div className="wlib-main">
            {items.length === 0 ? (
              <div className="wlib-empty">
                <strong>{loading ? "Loading the library…" : query ? `No ${labels.plural} match “${query}”.` : `No ${labels.plural} in the library yet.`}</strong>
                {loading ? null : <span>Upload new {labels.plural} with the button above, or drop files anywhere in this window.</span>}
              </div>
            ) : (
              <ul className="wlib-grid" role="listbox" aria-label={labels.tab} aria-multiselectable={multiple}>
                {items.map((item) => {
                  const position = selected.findIndex((entry) => entry.assetId === item.assetId);
                  const isTaken = taken.includes(item.assetId);
                  const classes = ["wlib-tile", position >= 0 ? "is-selected" : "", isTaken ? "is-taken" : ""].filter(Boolean).join(" ");
                  return (
                    <li key={item.assetId}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={position >= 0}
                        className={classes}
                        disabled={isTaken}
                        title={item.name}
                        onClick={() => toggle(item)}
                        onDoubleClick={() => {
                          if (!multiple) confirm([item]);
                        }}
                      >
                        <span className="wlib-thumb">
                          {kind === "video" ? (
                            <>
                              <video src={item.url} muted preload="metadata" />
                              <span className="wlib-play" aria-hidden="true" />
                            </>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts
                            <img src={item.url} alt={item.alt ?? ""} loading="lazy" />
                          )}
                          <span className="wlib-mark" aria-hidden="true">
                            {position >= 0 ? (multiple ? position + 1 : "✓") : null}
                          </span>
                          {isTaken ? <span className="wlib-flag">Already added</span> : null}
                        </span>
                        <span className="wlib-caption">
                          <span className="wlib-name">{item.name}</span>
                          <span className="wlib-meta">
                            {formatLabel(item.mimeType)}
                            {item.size ? ` · ${formatSize(item.size)}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMore ? (
              <button type="button" className="wbtn wbtn-ghost wlib-more" onClick={() => load(page + 1)} disabled={loading}>
                {loading ? "Loading…" : `Load more ${labels.plural}`}
              </button>
            ) : null}
          </div>

          <aside className="wlib-inspector" aria-label="Selected file">
            {focus ? (
              <>
                <div className="wlib-preview">
                  {mediaKindOf(focus.mimeType) === "video" ? (
                    <video src={focus.url} controls muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts
                    <img src={focus.url} alt={focus.alt ?? ""} />
                  )}
                </div>
                <p className="wlib-inspector-name">{focus.name}</p>
                <dl className="wlib-facts">
                  <div>
                    <dt>Type</dt>
                    <dd>{formatLabel(focus.mimeType)}</dd>
                  </div>
                  {focus.size ? (
                    <div>
                      <dt>Size</dt>
                      <dd>{formatSize(focus.size)}</dd>
                    </div>
                  ) : null}
                  {focus.width && focus.height ? (
                    <div>
                      <dt>Dimensions</dt>
                      <dd>
                        {focus.width} × {focus.height}
                      </dd>
                    </div>
                  ) : null}
                  {focus.createdAt ? (
                    <div>
                      <dt>Uploaded</dt>
                      <dd>{formatDate(focus.createdAt)}</dd>
                    </div>
                  ) : null}
                  {focus.alt ? (
                    <div className="wlib-fact-wide">
                      <dt>Alt text</dt>
                      <dd>{focus.alt}</dd>
                    </div>
                  ) : null}
                </dl>
              </>
            ) : (
              <div className="wlib-inspector-empty">
                <strong>Nothing selected</strong>
                <span>Select {multiple ? `one or more ${labels.plural}` : kind === "image" ? "an image" : "a video"} to preview it here.</span>
              </div>
            )}
          </aside>
        </div>

        {dragging ? (
          <div className="wlib-drop" aria-hidden="true">
            Drop {labels.plural} to upload them to the library
          </div>
        ) : null}
      </div>

      <div className="wdialog-foot wlib-foot">
        <span className="wlib-note">{footNote}</span>
        <button type="button" className="wbtn wbtn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="wbtn wbtn-primary" onClick={() => confirm()} disabled={selected.length === 0 || uploader.busy}>
          {confirmLabel}
          {selected.length > 1 ? ` (${selected.length})` : ""}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
