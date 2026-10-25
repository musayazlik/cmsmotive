"use client";

import RowActions from "@/app/panel/_components/row-actions";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../../../_components/confirm-dialog";
import { deleteProductTypeAction, saveProductTypeAction } from "../_actions";
import type { ProductTypeRow } from "../_lib";

type DialogKind = "create" | "edit" | null;

const EMPTY_FORM = { key: "", name: "", pluralName: "", description: "", listPath: "", position: "0" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Follows the name while untouched, like the category and post slugs. */
function previewKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Where the type's listing lives, for the table cell. */
function listingLabel(type: Pick<ProductTypeRow, "key" | "listPath">) {
  return type.listPath || `/products?type=${type.key}`;
}

export default function TypeManager({ types }: { types: ProductTypeRow[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<DialogKind>(null);
  const [editing, setEditing] = useState<ProductTypeRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProductTypeRow | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setKeyTouched(false);
    setError("");
    setKind("create");
  }

  function openEdit(type: ProductTypeRow) {
    setEditing(type);
    setForm({
      key: type.key,
      name: type.name,
      pluralName: type.pluralName,
      description: type.description ?? "",
      listPath: type.listPath ?? "",
      position: String(type.position),
    });
    setKeyTouched(true);
    setError("");
    setKind("edit");
  }

  function closeDialog() {
    setKind(null);
  }

  async function submit() {
    setBusy(true);
    setError("");
    const result = await saveProductTypeAction({
      id: editing?.id,
      key: form.key,
      name: form.name,
      pluralName: form.pluralName,
      description: form.description,
      listPath: form.listPath,
      position: form.position.trim() === "" ? 0 : Number(form.position),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeDialog();
    router.refresh();
  }

  async function confirmDeleteType() {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteProductTypeAction(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const productsTyped = types.reduce((sum, type) => sum + type.products, 0);
  const mostUsed = types.reduce<ProductTypeRow | null>((top, type) => (!top || type.products > top.products ? type : top), null);
  const withoutProducts = types.filter((type) => type.products === 0).length;

  return (
    <>
      <div className="wpage-stats">
        <div>
          <span>Total types</span>
          <strong>{types.length}</strong>
        </div>
        <div>
          <span>Products typed</span>
          <strong>{productsTyped}</strong>
        </div>
        <div>
          <span>Most used</span>
          <strong>{mostUsed ? mostUsed.name : "—"}</strong>
        </div>
        <div>
          <span>Without products</span>
          <strong>{withoutProducts}</strong>
        </div>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <p className="wtable-count">Every kind of product, shared by every store.</p>
          <div className="wtable-tools">
            <button type="button" className="wbtn wbtn-primary wbtn-add" onClick={openCreate}>
              New type
            </button>
          </div>
        </div>

        {error ? (
          <p className="wdialog-error" role="alert" style={{ margin: "14px 19px 0" }}>
            {error}
          </p>
        ) : null}

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th>Type</th>
                <th>Plural</th>
                <th>Listing</th>
                <th>Products</th>
                <th>Updated</th>
                <th scope="col" className="wtable-actions-col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={6}>
                    No types yet — every product needs one, so create the first kind.
                  </td>
                </tr>
              ) : (
                types.map((type) => (
                  <tr key={type.id}>
                    <td>
                      <div className="wtable-user">
                        <span className="wtable-avatar" aria-hidden="true">
                          {type.name[0]?.toUpperCase() ?? "?"}
                        </span>
                        <div>
                          <strong>{type.name}</strong>
                          <small className="status-slug" title={type.description ?? undefined}>
                            {type.key}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{type.pluralName}</td>
                    <td>
                      <span className="status-slug" title={listingLabel(type)}>
                        {listingLabel(type)}
                      </span>
                    </td>
                    <td>
                      <span className={`wbadge ${type.products > 0 ? "wbadge-user" : "wbadge-missing"}`}>{type.products}</span>
                    </td>
                    <td className="wtable-date">{formatDate(type.updatedAt)}</td>
                    <td className="wtable-actions-col">
                      <RowActions label={type.name} actions={[
                        { label: "Edit", onSelect: () => openEdit(type) },
                        ...(type.products === 0
                          ? [{ label: "Delete", danger: true, separated: true, onSelect: () => setPendingDelete(type) }]
                          : []),
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="wdialog"
        onClose={closeDialog}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        <div className="wdialog-head">
          <div>
            <span className="wdialog-eyebrow">Products / Types</span>
            <h2>{kind === "edit" ? `Edit ${editing?.name}` : "New type"}</h2>
          </div>
          <button type="button" className="wdialog-close" aria-label="Close" onClick={closeDialog}>
            ×
          </button>
        </div>
        <div className="wdialog-body">
          <div className="wform">
            <div className="wfield">
              <label htmlFor="type-name">Name</label>
              <input
                id="type-name"
                type="text"
                value={form.name}
                maxLength={40}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name,
                    key: keyTouched || kind === "edit" ? prev.key : previewKey(name),
                  }));
                }}
                placeholder="Theme"
                required
              />
            </div>
            <div className="wfield-row">
              <div className="wfield">
                <label htmlFor="type-key">
                  Key<span className="wfield-hint">{kind === "edit" ? "fixed once products use it" : "follows the name"}</span>
                </label>
                <input
                  id="type-key"
                  type="text"
                  value={form.key}
                  maxLength={40}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  disabled={kind === "edit"}
                  onChange={(event) => {
                    setKeyTouched(true);
                    setForm((prev) => ({ ...prev, key: event.target.value }));
                  }}
                  placeholder="theme"
                  required
                />
              </div>
              <div className="wfield">
                <label htmlFor="type-plural">
                  Plural name<span className="wfield-hint">listing title</span>
                </label>
                <input
                  id="type-plural"
                  type="text"
                  value={form.pluralName}
                  maxLength={40}
                  onChange={(event) => setForm((prev) => ({ ...prev, pluralName: event.target.value }))}
                  placeholder="Themes"
                  required
                />
              </div>
            </div>
            <div className="wfield">
              <label htmlFor="type-description">
                Description<span className="wfield-hint">optional</span>
              </label>
              <textarea
                id="type-description"
                value={form.description}
                maxLength={300}
                rows={2}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What this kind of product is, shown on its listing page intro."
              />
            </div>
            <div className="wfield-row">
              <div className="wfield">
                <label htmlFor="type-list-path">
                  Listing page<span className="wfield-hint">optional</span>
                </label>
                <input
                  id="type-list-path"
                  type="text"
                  value={form.listPath}
                  onChange={(event) => setForm((prev) => ({ ...prev, listPath: event.target.value }))}
                  placeholder="/themes"
                />
                <span className="wfield-hint-block">Public page of this type; empty = /products?type=&lt;key&gt;.</span>
              </div>
              <div className="wfield">
                <label htmlFor="type-position">
                  Sort order<span className="wfield-hint">pickers first</span>
                </label>
                <input
                  id="type-position"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.position}
                  onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            {error ? (
              <p className="wdialog-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="wdialog-foot">
          <button type="button" className="wbtn wbtn-ghost" onClick={closeDialog} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="wbtn wbtn-primary" onClick={submit} disabled={busy || !form.name.trim() || !form.key.trim() || !form.pluralName.trim()}>
            {busy ? "Saving…" : kind === "edit" ? "Save changes" : "Create type"}
          </button>
        </div>
      </dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? "type"}?`}
        body="Only types no product uses can be removed. The key stays reserved in URLs that already point at it."
        confirmLabel="Delete type"
        busy={busy}
        onConfirm={confirmDeleteType}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
