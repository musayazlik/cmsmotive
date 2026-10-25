"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { formatBytes } from "@/app/panel/media/_lib";
import { useDropTarget } from "../../_components/catalog-media";
import ConfirmDialog from "../../_components/confirm-dialog";
import { TextField } from "../../_components/ui";

type ReleaseRow = {
  id: string;
  version: string;
  fileName: string;
  codeLicense: string;
  createdAt: string;
};

type Props = {
  productId: string;
  releases: ReleaseRow[];
  /** Whether the product's code-license checklist step is complete; the upload endpoint rejects otherwise. */
  licenseReady: boolean;
};

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

/** Mirrors the productPackage endpoint's limit so a wrong file is caught before the upload starts. */
const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;

function packageProblem(file: File): string {
  if (!file.name.toLowerCase().endsWith(".zip")) return "Choose a .zip file; other formats are rejected.";
  if (file.size > MAX_PACKAGE_BYTES) return `This file is ${formatBytes(file.size)}; packages can be up to 128 MB.`;
  return "";
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <rect x="2" y="3" width="20" height="5" rx="1.5" />
      <path d="M10 12h4" />
    </svg>
  );
}

/**
 * Releases tab: the private ZIP packages customers download. Files go
 * straight to UploadThing's private storage; the database row is written by
 * the upload endpoint's onUploadComplete.
 */
export default function ReleaseManager({ productId, releases, licenseReady }: Props) {
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("productPackage", {
    onUploadProgress: setProgress,
    onClientUploadComplete: () => {
      setFile(null);
      setVersion("");
      setMessage("Package uploaded. Customers with the right entitlement can download it now.");
      router.refresh();
    },
    onUploadError: (cause) => setError(cause.message || "The package could not be uploaded."),
  });

  function choose(next: File | undefined) {
    if (!next) return;
    const problem = packageProblem(next);
    setFileError(problem);
    setMessage("");
    if (!problem) setFile(next);
  }

  const drop = useDropTarget((files) => choose(files[0]), isUploading);
  const browse = () => input.current?.click();

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFileError("Choose the ZIP package to upload.");
      return;
    }
    setError("");
    setMessage("");
    setProgress(0);
    await startUpload([file], { productId, version: version.trim() });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/releases/${confirmDelete.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The release could not be deleted.");
      else {
        setMessage(`Version ${confirmDelete.version} removed.`);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="wform-stack">
      <form className="wfield-card" onSubmit={handleUpload}>
        <div className="wmedia-head">
          <p className="wsection-label">Upload a package</p>
          <span className="wmedia-count">ZIP · max 128 MB</span>
        </div>
        <p className="wfield-hint-block wpkg-intro">
          One ZIP per version, stored privately. Customers download it while their entitlement covers the version —
          orders include the months of releases their price grants, subscriptions the active period.
        </p>
        {!licenseReady ? (
          <p className="wpkg-notice" role="note">
            Set the code license in the package checklist first; until then uploads are rejected.
          </p>
        ) : null}

        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {file ? (
          <div className={drop.dragging ? "wpkg-file is-dragging" : "wpkg-file"} {...drop.handlers}>
            <span className="wtable-avatar wmedia-thumb wmedia-tile wmedia-tile-archive" aria-hidden="true">
              ZIP
            </span>
            <div className="wpkg-file-meta">
              <strong title={file.name}>{file.name}</strong>
              <span>{isUploading ? `Uploading… ${progress}%` : formatBytes(file.size)}</span>
              {isUploading ? (
                <span
                  className="wpkg-progress"
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </span>
              ) : null}
            </div>
            {!isUploading ? (
              <div className="wpkg-file-tools">
                <button type="button" className="wbtn wbtn-sm wbtn-ghost" onClick={browse}>
                  Replace
                </button>
                <button type="button" className="wbtn wbtn-sm wbtn-danger-ghost" onClick={() => setFile(null)}>
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className={drop.dragging ? "wdrop wdrop-package is-dragging" : "wdrop wdrop-package"}
            onClick={browse}
            aria-describedby={fileError ? "rel-file-error" : undefined}
            {...drop.handlers}
          >
            <ArchiveIcon />
            <strong>Choose a ZIP package</strong>
            <span>or drop it here · up to 128 MB</span>
          </button>
        )}
        {fileError ? (
          <p className="wfield-error" id="rel-file-error" role="alert">
            {fileError}
          </p>
        ) : null}

        <div className="wpkg-submit">
          <TextField
            id="rel-version"
            label="Version"
            value={version}
            onChange={setVersion}
            required
            pattern="[a-zA-Z0-9.+-]{1,40}"
            placeholder="v1.0.0"
            note="Letters, numbers, dots, plus and minus."
          />
          <button className="wbtn wbtn-primary" type="submit" disabled={isUploading || !licenseReady}>
            {isUploading ? "Uploading…" : "Upload package"}
          </button>
        </div>
      </form>

      <div className="wfield-card">
        <p className="wsection-label">Published versions</p>
        {releases.length === 0 ? (
          <p className="wrepeat-empty">No packages yet. Until one is uploaded, buyers receive their licence key but no download.</p>
        ) : (
          <div className="wrepeat wrepeat-table" role="table" aria-label="Releases">
            <div className="wrepeat-head" role="row">
              <span role="columnheader">Version</span>
              <span role="columnheader">File</span>
              <span role="columnheader">Uploaded</span>
              <span aria-hidden="true" />
            </div>
            {releases.map((release) => (
              <div className="wrepeat-row" role="row" key={release.id}>
                <span role="cell">
                  <strong>{release.version}</strong>
                </span>
                <span role="cell">
                  <small className="status-slug" title={release.fileName}>
                    {release.fileName}
                  </small>
                </span>
                <span role="cell">
                  <small>{stamp(release.createdAt)}</small>
                </span>
                <div className="wrepeat-tools">
                  <button type="button" className="is-danger" onClick={() => setConfirmDelete(release)} aria-label={`Remove ${release.version}`}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="wfield-hint-block">
          Removing a version takes it out of storage; customers immediately lose access to that download.
        </p>
      </div>

      {error ? (
        <p className="wdialog-error wpost-feedback" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="wfield-hint-block wpost-feedback" role="status">
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Remove version ${confirmDelete?.version ?? ""}?`}
        body="The package is deleted from private storage and customers can no longer download it. This cannot be undone."
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
