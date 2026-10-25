"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import ConfirmDialog from "../../_components/confirm-dialog";
import { DatePicker, Select, TextField, toISO } from "../../_components/ui";
import { CHANGE_KINDS, CHANGELOG_LIMITS, type ChangeKind } from "@/lib/catalog-guard";
import { CHANGE_LABELS, type ChangelogRecord, type ProductOption } from "../_lib";

type Props = {
  products: ProductOption[];
  /** The entry to edit; omitted on the create page. */
  record?: ChangelogRecord;
  /** The product chosen before the form opened (from a product's edit page). */
  initialProduct?: string;
};

type Draft = { kind: ChangeKind; text: string };

const KIND_OPTIONS = CHANGE_KINDS.map((kind) => ({ value: kind, label: CHANGE_LABELS[kind] }));

/** Create and edit form for one release note of one product. */
export default function ChangelogForm({ products, record, initialProduct = "" }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState(record?.product ?? (products.some((option) => option.value === initialProduct) ? initialProduct : ""));
  const [version, setVersion] = useState(record?.version ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [releasedAt, setReleasedAt] = useState(record?.releasedAt ?? toISO(new Date()));
  const [changes, setChanges] = useState<Draft[]>(record?.changes.length ? record.changes : [{ kind: "new", text: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (index: number, patch: Partial<Draft>) => setChanges((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, by: -1 | 1) =>
    setChanges((rows) => {
      const next = [...rows];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      setError("Choose the product this entry belongs to.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(record ? `/api/admin/changelog/${record.id}` : "/api/admin/changelog", {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product, version, title, releasedAt, changes }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The entry could not be saved.");
        return;
      }
      router.push("/panel/changelog");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!record) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/changelog/${record.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The entry could not be deleted.");
        return;
      }
      router.push("/panel/changelog");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const selected = products.find((option) => option.value === product);

  return (
    <>
      <form className="wform-card" onSubmit={handleSubmit}>
        <div className="wpost-toolbar">
          <Link className="wbtn wbtn-ghost" href="/panel/changelog">
            ← Back to changelog
          </Link>
          {record ? (
            <div className="wpost-toolbar-actions">
              <button type="button" className="wbtn wbtn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Delete entry
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="wdialog-error wpost-feedback" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wform-grid">
          <div className="wform-main wform-stack">
            <div className="wfield-card">
              <p className="wsection-label">Release</p>
              <div className="wform">
                <Select
                  id="cl-product"
                  label="Product"
                  value={product}
                  onChange={(value) => {
                    setProduct(value);
                    setError("");
                  }}
                  options={products}
                  placeholder="Choose a product"
                  note="Required. The entry appears in the Changelog tab of this product's detail page."
                />
                <div className="wfield-row">
                  <TextField
                    id="cl-version"
                    label="Version"
                    value={version}
                    onChange={setVersion}
                    required
                    maxLength={CHANGELOG_LIMITS.version}
                    placeholder="v1.2.0"
                  />
                  <DatePicker id="cl-date" label="Release date" value={releasedAt} onChange={setReleasedAt} note="The site shows month and year." />
                </div>
                <TextField
                  id="cl-title"
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  required
                  maxLength={CHANGELOG_LIMITS.title}
                  placeholder="Editorial modules"
                />
              </div>
            </div>

            <div className="wfield-card">
              <div className="wmedia-head">
                <p className="wsection-label">Changes</p>
                <span className="wmedia-count">
                  {changes.length} / {CHANGELOG_LIMITS.changes}
                </span>
              </div>
              <div className="wrepeat wrepeat-changes" role="table" aria-label="Changes">
                <div className="wrepeat-head" role="row">
                  <span role="columnheader">Type</span>
                  <span role="columnheader">What changed</span>
                  <span aria-hidden="true" />
                </div>
                {changes.map((change, index) => (
                  <div className="wrepeat-row" role="row" key={index}>
                    <select
                      aria-label={`Change ${index + 1} type`}
                      className={`wchange-kind is-${change.kind}`}
                      value={change.kind}
                      onChange={(event) => update(index, { kind: event.target.value as ChangeKind })}
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Change ${index + 1}`}
                      value={change.text}
                      maxLength={CHANGELOG_LIMITS.change}
                      placeholder="Describe one change in a sentence."
                      onChange={(event) => update(index, { text: event.target.value })}
                    />
                    <div className="wrepeat-tools">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move change ${index + 1} up`}>
                        ↑
                      </button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === changes.length - 1} aria-label={`Move change ${index + 1} down`}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => setChanges((rows) => rows.filter((_, i) => i !== index))}
                        disabled={changes.length === 1}
                        aria-label={`Remove change ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wrepeat-actions">
                <button
                  type="button"
                  className="wbtn wbtn-ghost wbtn-sm"
                  onClick={() => setChanges((rows) => [...rows, { kind: "new", text: "" }])}
                  disabled={changes.length >= CHANGELOG_LIMITS.changes}
                >
                  + Add change
                </button>
              </div>
              <p className="wfield-hint-block">Each line is listed with its type tag (New, Improved, Fixed). Empty lines are ignored.</p>
            </div>
          </div>

          <div className="wform-side">
            <div className="wfield-card">
              <p className="wsection-label">Publish</p>
              <dl className="wpub-status wpub-status-flush">
                <div>
                  <dt>Product</dt>
                  <dd>{selected ? selected.label : "Not chosen yet"}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{version || "—"}</dd>
                </div>
              </dl>
              <div className="wpub-actions">
                <button className="wbtn wbtn-primary wbtn-block" type="submit" disabled={saving}>
                  {saving ? "Saving…" : record ? "Save changes" : "Add to changelog"}
                </button>
                <Link className="wbtn wbtn-ghost wbtn-block" href="/panel/changelog">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${record?.version ?? "this entry"}?`}
        body="The entry disappears from the product's Changelog tab. This cannot be undone."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
