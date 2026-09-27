"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import Select from "@/app/panel/_components/ui/select";
import MediaUpload from "./media-upload";
import { deleteMedia } from "../_actions";
import {
  SOURCE_BADGES,
  SOURCE_LABELS,
  fileTile,
  formatBytes,
  formatDate,
  isRasterImage,
  mediaKind,
  usageSummary,
  type MediaRow,
  type MediaUsageInfo,
} from "../_lib";

type SortKey = "newest" | "oldest" | "largest" | "smallest" | "name";

/**
 * Thumbnail for a media row: raster images render themselves, everything
 * else (svg, pdf, archives, unknown) gets a colored extension tile so the
 * table never shows a broken or empty preview.
 */
function MediaThumb({ file }: { file: MediaRow }) {
  const [broken, setBroken] = useState(false);

  if (!broken && file.source !== "missing" && file.url && isRasterImage(file.mimeType)) {
    return (
      // UploadThing returns arbitrary remote hosts, so a plain img keeps the host list clean.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="wtable-avatar wtable-avatar-img wmedia-thumb"
        src={file.url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  const tile = fileTile(file.name, file.mimeType);
  return (
    <span className={`wtable-avatar wmedia-thumb wmedia-tile wmedia-tile-${tile.tone}`} aria-hidden="true">
      {tile.tone === "video" ? "▶" : tile.label}
    </span>
  );
}

function StorageMeter({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const free = Math.max(0, limit - used);
  return (
    <>
      <div
        className="wmeter"
        role="img"
        aria-label={`${percent}% of the storage plan used`}
        title={`${percent}% of ${formatBytes(limit)}`}
      >
        <span style={{ width: `${percent}%` }} data-high={percent >= 90 ? "" : undefined} />
      </div>
      <small className="wmeter-cap">
        {formatBytes(limit)} plan · {formatBytes(free)} free
      </small>
    </>
  );
}

export default function MediaList({
  files,
  usage,
  utError,
  truncated,
}: {
  files: MediaRow[];
  usage: MediaUsageInfo | null;
  utError: string | null;
  truncated: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MediaRow | null>(null);

  const counts = useMemo(
    () => ({
      total: files.length,
      tracked: files.filter((file) => file.source === "tracked").length,
      untracked: files.filter((file) => file.source === "untracked").length,
      missing: files.filter((file) => file.source === "missing").length,
    }),
    [files],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = files.filter((file) => {
      if (typeFilter !== "all" && mediaKind(file.mimeType) !== typeFilter) return false;
      if (sourceFilter !== "all" && file.source !== sourceFilter) return false;
      if (needle && !`${file.name} ${file.key} ${file.mimeType}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
        break;
      case "largest":
        sorted.sort((a, b) => b.size - a.size);
        break;
      case "smallest":
        sorted.sort((a, b) => a.size - b.size);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    }
    return sorted;
  }, [files, query, typeFilter, sourceFilter, sort]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setError("");
    const result = await deleteMedia(pendingDelete.key);
    setBusyId(null);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function copyUrl(file: MediaRow) {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId((current) => (current === file.id ? null : current)), 1600);
    } catch {
      setError("The URL could not be copied to the clipboard.");
    }
  }

  return (
    <>
      <div className="wpage-stats">
        <div>
          <span>Files in storage</span>
          <strong>{usage ? usage.filesUploaded : counts.total}</strong>
        </div>
        <div>
          <span>Storage used</span>
          <strong>{usage ? formatBytes(usage.totalBytes) : "—"}</strong>
          {usage ? <StorageMeter used={usage.totalBytes} limit={usage.limitBytes} /> : null}
        </div>
        <div>
          <span>Tracked assets</span>
          <strong>{counts.tracked}</strong>
        </div>
        <div>
          <span>Untracked files</span>
          <strong>{counts.untracked}</strong>
        </div>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file name, key or type"
              aria-label="Search media"
            />
          </div>
          <div className="wtable-filters">
            <Select
              id="filter-media-type"
              label="Type"
              hideLabel
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All types" },
                { value: "image", label: "Images" },
                { value: "video", label: "Videos" },
                { value: "other", label: "Other" },
              ]}
            />
            <Select
              id="filter-media-source"
              label="Tracking"
              hideLabel
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "all", label: "All files" },
                { value: "tracked", label: "Tracked" },
                { value: "untracked", label: "Untracked" },
                ...(counts.missing > 0 ? [{ value: "missing", label: "Missing" }] : []),
              ]}
            />
            <Select
              id="sort-media"
              label="Sort"
              hideLabel
              value={sort}
              onChange={(next) => setSort(next as SortKey)}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "largest", label: "Largest first" },
                { value: "smallest", label: "Smallest first" },
                { value: "name", label: "Name A–Z" },
              ]}
            />
          </div>
          <div className="wtable-tools">
            <MediaUpload />
          </div>
        </div>

        {utError ? (
          <p className="wdialog-error" role="alert" style={{ margin: "14px 19px 0" }}>
            UploadThing stats are unavailable ({utError}). Showing the database records only.
          </p>
        ) : null}
        {error ? (
          <p className="wdialog-error" role="alert" style={{ margin: "14px 19px 0" }}>
            {error}
          </p>
        ) : null}

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Status</th>
                <th>Used in</th>
                <th>Uploaded</th>
                <th scope="col" className="wtable-actions-col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={6}>
                    No media matches the current filters.
                  </td>
                </tr>
              ) : (
                visible.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="wtable-user">
                        <MediaThumb file={file} />
                        <div>
                          <strong title={file.name}>{file.name}</strong>
                          <small>{file.mimeType || "unknown type"}</small>
                        </div>
                      </div>
                    </td>
                    <td className="wtable-date">{formatBytes(file.size)}</td>
                    <td>
                      <span className={SOURCE_BADGES[file.source]}>{SOURCE_LABELS[file.source]}</span>
                      {file.status && file.status !== "Uploaded" ? (
                        <span className="wbadge wbadge-pending">{file.status}</span>
                      ) : null}
                    </td>
                    <td>
                      {usageSummary(file.usage).length === 0 ? (
                        <span>—</span>
                      ) : (
                        <span className="wchip-row">
                          {usageSummary(file.usage).map((part) => (
                            <span className="wchip" key={part}>
                              {part}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="wtable-date" title={file.uploader ? `Uploaded by ${file.uploader}` : undefined}>
                      {formatDate(file.uploadedAt)}
                    </td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <button type="button" className="wbtn wbtn-ghost wbtn-sm" disabled={file.source === "missing"} onClick={() => copyUrl(file)}>
                          {copiedId === file.id ? "Copied" : "Copy URL"}
                        </button>
                        {file.source !== "missing" ? (
                          <a className="wbtn wbtn-ghost wbtn-sm" href={file.url} target="_blank" rel="noreferrer">
                            Open ↗
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="wbtn wbtn-danger-ghost wbtn-sm"
                          disabled={busyId === file.id}
                          onClick={() => setPendingDelete(file)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">
            {visible.length} of {counts.total} files
            {usage ? ` · ${formatBytes(usage.totalBytes)} stored` : ""}
            {truncated ? " · showing the newest files" : ""}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this file?"
        body={
          pendingDelete
            ? `"${pendingDelete.name}" is removed from UploadThing storage permanently. Pages using it lose the image${
                usageSummary(pendingDelete.usage).length > 0 ? ` (${usageSummary(pendingDelete.usage).join(", ").toLowerCase()})` : ""
              }. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete file"
        busy={busyId !== null}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
