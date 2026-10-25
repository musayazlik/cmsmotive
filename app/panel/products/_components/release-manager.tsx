"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
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

/**
 * Releases tab: the private ZIP packages customers download. Files go
 * straight to UploadThing's private storage; the database row is written by
 * the upload endpoint's onUploadComplete.
 */
export default function ReleaseManager({ productId, releases, licenseReady }: Props) {
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { startUpload, isUploading } = useUploadThing("productPackage", {
    onClientUploadComplete: () => {
      setFile(null);
      setVersion("");
      setMessage("Package uploaded. Customers with the right entitlement can download it now.");
      router.refresh();
    },
    onUploadError: (cause) => setError(cause.message || "The package could not be uploaded."),
  });

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setMessage("");
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
        <p className="wsection-label">Upload a package</p>
        <p className="wfield-hint-block">
          One ZIP per version, stored privately. Customers download it while their entitlement covers the version —
          orders include the months of releases their price grants, subscriptions the active period.
          {!licenseReady ? " Complete the Code license step of the release checklist first; the upload is rejected otherwise." : ""}
        </p>
        <div className="wform">
          <div className="wfield-row">
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
            <label className="wfield">
              <span className="wfield-label-like">Package file (ZIP)</span>
              <input
                type="file"
                accept=".zip,application/zip"
                required
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <span className="wfield-hint-block">Up to 128 MB per package.</span>
            </label>
          </div>
        </div>
        <div className="wpub-actions">
          <button className="wbtn wbtn-primary" type="submit" disabled={isUploading || !file}>
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
