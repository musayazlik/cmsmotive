"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { Fragment, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { MAX_PACKAGE_BYTES, type PackageStorageProvider } from "@/lib/package-storage-config";
import { uploadR2Package } from "@/lib/package-upload-client";
import { formatBytes } from "@/app/panel/media/_lib";
import { useDropTarget } from "../../_components/catalog-media";
import ConfirmDialog from "../../_components/confirm-dialog";
import { TextField } from "../../_components/ui";
import type { PackageAudit } from "@/lib/package-audit";

type ReleaseRow = {
  id: string;
  version: string;
  fileName: string;
  codeLicense: string;
  createdAt: string;
  /** Licence audit report; null for packages uploaded before audits. */
  audit: PackageAudit | null;
};

type Props = {
  productId: string;
  releases: ReleaseRow[];
  /** Why the code licence blocks uploads (missing, or not GPL where the store requires it); null when fine. */
  licenseProblem: string | null;
  /** The store sells GPL code (Settings → Legal); packages are audited strictly. */
  gplRequired: boolean;
  storage: { provider: PackageStorageProvider; configured: boolean; error: string };
};

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

function packageProblem(file: File): string {
  if (!file.name.toLowerCase().endsWith(".zip")) return "Choose a .zip file; other formats are rejected.";
  if (file.size === 0) return "The selected ZIP file is empty.";
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
 * directly to the configured private storage; only completed uploads become releases.
 */
function AuditBadge({ audit }: { audit: PackageAudit | null }) {
  if (!audit) return <span className="wbadge wbadge-user">Not checked</span>;
  if (audit.errors.length) return <span className="wbadge wbadge-danger">{audit.errors.length} {audit.errors.length === 1 ? "problem" : "problems"}</span>;
  if (audit.warnings.length) return <span className="wbadge wbadge-pending">{audit.warnings.length} {audit.warnings.length === 1 ? "warning" : "warnings"}</span>;
  return <span className="wbadge wbadge-verified">Passed</span>;
}

function AuditDetails({ audit }: { audit: PackageAudit }) {
  const issues = [...audit.errors.map((issue) => ({ ...issue, level: "error" })), ...audit.warnings.map((issue) => ({ ...issue, level: "warning" }))];
  return (
    <div className="wpkg-audit">
      <p>
        Licence file: <strong>{audit.licenseFile ?? "none"}</strong>
        {audit.licenseKind ? ` (${audit.licenseKind})` : ""} · Notices: <strong>{audit.noticesFile ?? "none"}</strong> · Own source files:{" "}
        {audit.sourceFiles} · Bundled packages: {audit.dependencies.length}
        {audit.gplRequired ? " · GPL rules applied" : ""}
      </p>
      {issues.length ? (
        <ul>
          {issues.map((issue) => (
            <li key={`${issue.level}-${issue.code}`} data-level={issue.level}>
              <strong>{issue.level === "error" ? "Problem" : "Warning"}:</strong> {issue.message}
              {issue.files?.length ? <code>{issue.files.join(", ")}</code> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing to fix.</p>
      )}
    </div>
  );
}

export default function ReleaseManager({ productId, releases, licenseProblem, gplRequired, storage }: Props) {
  const licenseReady = !licenseProblem;
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [r2Uploading, setR2Uploading] = useState(false);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  async function recheck(release: ReleaseRow) {
    setChecking(release.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/releases/${release.id}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error ?? "The licence check could not run.");
      else setOpenAudit(release.id);
      router.refresh();
    } finally {
      setChecking(null);
    }
  }
  const input = useRef<HTMLInputElement>(null);

  function completed() {
    setFile(null);
    setVersion("");
    setMessage("Package uploaded. Customers with the right entitlement can download it now.");
    router.refresh();
  }

  const { startUpload, isUploading: uploadthingUploading } = useUploadThing("productPackage", {
    onUploadProgress: setProgress,
    onClientUploadComplete: (files) => {
      // A package refused by the licence audit comes back without a release.
      const refused = files.find((entry) => entry.serverData?.error)?.serverData?.error;
      if (refused) setError(refused);
      else completed();
    },
    onUploadError: (cause) => setError(cause.message || "The package could not be uploaded."),
  });
  const isUploading = r2Uploading || uploadthingUploading;

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
    if (isUploading || !licenseReady || !storage.configured) return;
    if (!file) {
      setFileError("Choose the ZIP package to upload.");
      return;
    }
    setError("");
    setMessage("");
    setProgress(0);
    if (storage.provider === "uploadthing") {
      await startUpload([file], { productId, version: version.trim() });
      return;
    }
    setR2Uploading(true);
    try {
      await uploadR2Package(file, { productId, version: version.trim() }, setProgress);
      completed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The package could not be uploaded.");
    } finally { setR2Uploading(false); }
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
            {licenseProblem} Until then uploads are rejected.
          </p>
        ) : null}
        {!storage.configured ? (
          <p className="wpkg-notice" role="note">{storage.error}</p>
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
          <button className="wbtn wbtn-primary" type="submit" disabled={isUploading || !licenseReady || !storage.configured}>
            {isUploading ? "Uploading…" : "Upload package"}
          </button>
        </div>
        <p className="wfield-hint-block">
          Every package gets a licence check before customers can download it: a LICENSE or COPYING file at the top
          {gplRequired ? " containing the GNU GPL text" : ""}, readable (not encoded) source, licence headers in source files and a
          THIRD-PARTY-NOTICES file when libraries are bundled.
          {gplRequired
            ? " This store sells GPL code, so a missing GPL text or encoded code refuses the upload."
            : " A missing licence file refuses the upload."}
        </p>
      </form>

      <section className="wfield-card wpkg-releases" aria-labelledby="rel-published-title">
        <div className="wmedia-head">
          <h2 className="wsection-label" id="rel-published-title">Published versions</h2>
          <span className="wpkg-release-count">{releases.length} {releases.length === 1 ? "version" : "versions"}</span>
        </div>
        {releases.length === 0 ? (
          <div className="wpkg-releases-empty">
            <ArchiveIcon />
            <strong>No published versions yet</strong>
            <p>Upload your first ZIP package above. Until then, buyers receive their licence key but no download.</p>
          </div>
        ) : (
          <div className="wpkg-release-scroll" role="region" aria-label="Published versions table" tabIndex={0}>
            <table className="wpkg-release-table" aria-labelledby="rel-published-title">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Package file</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Licence check</th>
                  <th scope="col" className="wpkg-release-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <Fragment key={release.id}>
                  <tr>
                    <th scope="row"><span className="wpkg-release-version">{release.version}</span></th>
                    <td>
                      <div className="wpkg-release-file">
                        <span className="wpkg-release-icon"><ArchiveIcon /></span>
                        <span>{release.fileName}</span>
                      </div>
                    </td>
                    <td><time dateTime={release.createdAt}>{stamp(release.createdAt)}</time></td>
                    <td>
                      <div className="wpkg-audit-cell">
                        {release.audit ? (
                          <button type="button" className="wpkg-audit-toggle" aria-expanded={openAudit === release.id} onClick={() => setOpenAudit(openAudit === release.id ? null : release.id)}>
                            <AuditBadge audit={release.audit} />
                          </button>
                        ) : (
                          <AuditBadge audit={null} />
                        )}
                        <button type="button" className="wbtn wbtn-sm wbtn-ghost" onClick={() => recheck(release)} disabled={checking !== null}>
                          {checking === release.id ? "Checking…" : release.audit ? "Re-check" : "Check"}
                        </button>
                      </div>
                    </td>
                    <td className="wpkg-release-actions">
                      <button
                        type="button"
                        className="wbtn wbtn-sm wbtn-danger-ghost wpkg-release-remove"
                        onClick={() => setConfirmDelete(release)}
                        aria-label={`Remove version ${release.version}`}
                        disabled={deleting}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
                        </svg>
                        Remove
                      </button>
                    </td>
                  </tr>
                  {openAudit === release.id && release.audit ? (
                    <tr className="wpkg-audit-row">
                      <td colSpan={5}>
                        <AuditDetails audit={release.audit} />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="wfield-hint-block">
          Removing a version takes it out of storage; customers immediately lose access to that download.
        </p>
      </section>

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
