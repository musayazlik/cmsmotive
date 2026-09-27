"use client";

import { useEffect, useRef, useState } from "react";
import RichTextEditor from "./rich-text-editor";
import ImageField, { type UploadedImage } from "./image-field";
import { Select, TextArea, TextField } from "./ui";

export type CatalogRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: string;
  description: string;
  industry?: string;
  versionTarget?: string;
  cover: { assetId: string; url: string; name: string } | null;
  gallery: { assetId: string; url: string; name: string }[];
};

type Props = {
  kind: "edit" | "delete" | null;
  record: CatalogRecord | null;
  endpoint: "themeMedia" | "extensionMedia";
  api: string;
  /** Theme forms carry the extra industry / version selects. */
  variant: "theme" | "extension";
  statuses: readonly string[];
  industries?: readonly string[];
  versions?: readonly string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CatalogDialog({
  kind,
  record,
  endpoint,
  api,
  variant,
  statuses,
  industries,
  versions,
  onClose,
  onSaved,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ name: "", slug: "", summary: "", description: "", status: "", industry: "", versionTarget: "" });
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [gallery, setGallery] = useState<UploadedImage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed the fields whenever a record opens the dialog.
  useEffect(() => {
    if (!record) return;
    setForm({
      name: record.name,
      slug: record.slug,
      summary: record.summary,
      description: record.description,
      status: record.status,
      industry: record.industry ?? "",
      versionTarget: record.versionTarget ?? "",
    });
    setCover(record.cover ? [record.cover] : []);
    setGallery(record.gallery);
    setError("");
  }, [record]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  if (!kind || !record) {
    return <dialog ref={ref} className="wdialog" onClose={onClose} />;
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coverId: cover[0]?.assetId ?? null,
          galleryIds: gallery.map((image) => image.assetId),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "The change could not be saved.");
        return;
      }
      onClose();
      await onSaved();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(api, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "The record could not be deleted.");
        return;
      }
      onClose();
      await onSaved();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="wdialog" onClose={onClose} onCancel={onClose}>
      <header className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">{kind === "delete" ? "Confirm" : variant === "theme" ? "Themes" : "Extensions"}</span>
          <h2>{kind === "delete" ? `Delete ${variant}` : `Edit ${variant}`}</h2>
        </div>
        <button className="wdialog-close" type="button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="wdialog-body">
        {kind === "delete" ? (
          <p className="wdialog-text">
            <strong>{record.name}</strong> ({record.slug}) and its gallery will be permanently removed. The uploaded
            images stay in the media library. This cannot be undone.
          </p>
        ) : (
          <div className="wform">
            <TextField
              id="e-name"
              label="Name"
              value={form.name}
              minLength={2}
              maxLength={80}
              onChange={(name) => {
                setForm((prev) => ({ ...prev, name, slug: prev.slug === slugify(prev.name) ? slugify(name) : prev.slug }));
              }}
            />

            <TextArea
              id="e-summary"
              label="Summary"
              variant="line"
              value={form.summary}
              maxLength={300}
              onChange={(summary) => setForm((prev) => ({ ...prev, summary }))}
            />

            <div className="wfield-row">
              <TextField
                id="e-slug"
                label="Slug"
                value={form.slug}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                onChange={(slug) => setForm((prev) => ({ ...prev, slug }))}
              />
              <Select
                id="e-status"
                label="Status"
                value={form.status}
                options={statuses}
                onChange={(status) => setForm((prev) => ({ ...prev, status }))}
              />
            </div>

            {variant === "theme" ? (
              <div className="wfield-row">
                <Select
                  id="e-industry"
                  label="Industry"
                  value={form.industry}
                  options={industries ?? []}
                  onChange={(industry) => setForm((prev) => ({ ...prev, industry }))}
                />
                <Select
                  id="e-version"
                  label="TYPO3 version target"
                  value={form.versionTarget}
                  options={versions ?? []}
                  onChange={(versionTarget) => setForm((prev) => ({ ...prev, versionTarget }))}
                />
              </div>
            ) : null}

            <div className="wfield">
              <label htmlFor="e-description">Description</label>
              <RichTextEditor id="e-description" value={form.description} onChange={(html) => setForm((prev) => ({ ...prev, description: html }))} />
            </div>

            <div className="wdialog-media">
              <ImageField endpoint={endpoint} label="Cover image" value={cover} onChange={setCover} />
              <ImageField endpoint={endpoint} label="Gallery" multiple max={12} value={gallery} onChange={setGallery} />
            </div>
          </div>
        )}

        {error ? (
          <p className="wdialog-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="wdialog-foot">
        <button className="wbtn wbtn-ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {kind === "delete" ? (
          <button className="wbtn wbtn-danger" type="button" onClick={destroy} disabled={busy}>
            {busy ? "Deleting…" : `Delete ${variant}`}
          </button>
        ) : (
          <button className="wbtn wbtn-primary" type="button" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
      </footer>
    </dialog>
  );
}
