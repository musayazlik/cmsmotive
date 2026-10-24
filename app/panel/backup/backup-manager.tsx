"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { BACKUP_TABLE_LABELS, MAX_BACKUP_BYTES, type BackupSummary } from "@/lib/backup-shared";

export default function BackupManager({ restored }: { restored: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [pending, setPending] = useState<"preview" | "restore" | null>(null);
  const [backup, setBackup] = useState<unknown>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");

  async function download() {
    setExporting(true);
    setExportError("");
    setDownloaded(false);
    try {
      const response = await fetch("/api/admin/backup", { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "The backup could not be exported.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "cmsmotive-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : "Could not reach the server."); }
    finally { setExporting(false); }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSummary(null);
    setBackup(null);
    setError("");
    setConfirmation("");
    setPassword("");
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setError("Choose a JSON backup smaller than 25 MB."); return; }
    setPending("preview");
    try {
      let content: unknown;
      try { content = JSON.parse(await file.text()); }
      catch { throw new Error("This file is not valid JSON. Choose a CMSMotive backup."); }
      const response = await fetch("/api/admin/backup?mode=preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup: content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The backup could not be validated.");
      setBackup(content);
      setSummary(result.summary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reach the server."); }
    finally { setPending(null); }
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary || !backup || pending || confirmation !== "RESTORE" || !password) return;
    setPending("restore");
    setError("");
    try {
      const response = await fetch("/api/admin/backup?mode=restore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, confirmation, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "The backup could not be restored.");
        setPending(null);
        return;
      }
      setPassword("");
      // A full navigation refreshes provider defaults and follows a restored private panel address.
      window.location.replace(`${result.panelPath}/backup?restored=1`);
    } catch {
      setError("The connection was lost. Check the workspace before retrying; the restore may have completed.");
      setPending(null);
    }
  }

  return (
    <div className="wbackup">
      {restored && <p className="wbackup-success" role="status">Backup restored. Workspace content and panel settings are now up to date.</p>}
      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">What your backup includes</p>
          <p className="wbackup-copy">Themes and extensions with galleries and release notes; blog posts, categories, tags and comments; product reviews; media records; contact messages; newsletter subscribers; page views; and all settings saved in the panel.</p>
          <p className="wbackup-copy">Media URLs are included, but uploaded files stay with your storage provider. Keep those files available or back them up separately. Application code, static assets, server environment variables, user accounts, passwords and sign-in sessions are not included.</p>
          <p className="wbackup-notice">Backups contain private messages, email addresses and integration secrets saved in the panel, including Telegram credentials. Store the file securely and import only backups you trust.</p>
        </div>
      </div>

      <div className="wbackup-grid">
        <section className="wtable-card wsettings-card" aria-labelledby="export-title">
          <div className="wsettings-section">
            <p className="wsection-label">01 / Export</p>
            <h2 id="export-title" className="wbackup-title">Download a backup</h2>
            <p className="wbackup-copy">Create a JSON copy of your current workspace. Download a fresh copy before restoring an earlier backup.</p>
            <p className="wfield-hint-block">CMSMotive format v1 · Up to 25 MB</p>
            {exportError && <p className="wdialog-error" role="alert">{exportError}</p>}
          </div>
          <div className="wsettings-foot">
            <span className="wsettings-state" role="status">{downloaded ? "Download started." : exporting ? "Preparing backup…" : ""}</span>
            <button type="button" className="wbtn wbtn-primary" disabled={exporting || !!pending} onClick={download}>
              {exporting ? "Exporting…" : "Export backup"}
            </button>
          </div>
        </section>

        <section className="wtable-card wsettings-card" aria-labelledby="import-title">
          <form onSubmit={restore} aria-busy={!!pending}>
            <div className="wsettings-section">
              <p className="wsection-label">02 / Import</p>
              <h2 id="import-title" className="wbackup-title">Restore a workspace</h2>
              <p className="wbackup-copy">Choose a CMSMotive JSON backup to validate its contents and review the record counts before restoring.</p>
              <div className="wfield">
                <label htmlFor="backup-file">Backup file</label>
                <input id="backup-file" type="file" accept=".json,application/json" onChange={selectFile} disabled={!!pending || exporting} aria-describedby="backup-file-hint" />
                <p id="backup-file-hint" className="wfield-hint-block">Maximum 25 MB. Selecting a file does not change your data.</p>
              </div>
              <p role="status" className="wbackup-copy">{pending === "preview" ? "Validating backup…" : summary ? `${fileName} is ready to restore.` : ""}</p>
            </div>
            {summary && (
              <>
                <div className="wsettings-section">
                  <p className="wsection-label">Backup contents</p>
                  <p className="wbackup-copy">Created {new Date(summary.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Istanbul" })} (Istanbul)</p>
                  <dl className="wbackup-counts">
                    {Object.entries(BACKUP_TABLE_LABELS).map(([key, label]) => (
                      <div key={key}><dt>{label}</dt><dd>{summary.counts[key as keyof typeof BACKUP_TABLE_LABELS].toLocaleString("en-GB")}</dd></div>
                    ))}
                  </dl>
                </div>
                <div className="wsettings-section">
                  <p className="wbackup-notice">Restoring replaces all current workspace content and panel settings, including sections with zero records in this backup. User accounts remain available. If anything fails, all database changes are rolled back.</p>
                  <p className="wbackup-copy">The restored panel address will be <code>{summary.panelPath}</code>. Authors are matched to existing users by email; unmatched authors become unassigned. Telegram links to missing administrators are removed; MCP access is disabled if its selected administrator cannot be matched. Verify integrations after moving to another server.</p>
                  <div className="wfield">
                    <label htmlFor="backup-confirmation">Type RESTORE to replace current data</label>
                    <input id="backup-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required disabled={!!pending} />
                  </div>
                  <div className="wfield">
                    <label htmlFor="backup-password">Your current password</label>
                    <input id="backup-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} required disabled={!!pending} />
                  </div>
                </div>
              </>
            )}
            {error && <p className="wdialog-error wbackup-error" role="alert">{error}</p>}
            <div className="wsettings-foot">
              <span className="wsettings-state" role="status">{pending === "restore" ? "Restoring backup. Keep this page open…" : ""}</span>
              <button type="submit" className="wbtn wbtn-danger" disabled={!summary || !!pending || exporting || confirmation !== "RESTORE" || !password}>
                {pending === "restore" ? "Restoring…" : "Restore backup"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
