"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import ColorField from "./color-field";
import { deleteCategory, saveCategory } from "../_actions";
import type { CategoryRow } from "../_lib";

type DialogKind = "create" | "edit" | null;

const EMPTY_FORM = { name: "", slug: "", description: "", color: "#4353e8" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Follows the title while untouched, like the post form slug. */
function previewSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<DialogKind>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setError("");
    setKind("create");
  }

  function openEdit(category: CategoryRow) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, description: category.description ?? "", color: category.color });
    setSlugTouched(true);
    setError("");
    setKind("edit");
  }

  function closeDialog() {
    setKind(null);
  }

  async function submit() {
    setBusy(true);
    setError("");
    const result = await saveCategory({
      id: editing?.id,
      name: form.name,
      slug: form.slug,
      description: form.description,
      color: form.color,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeDialog();
    router.refresh();
  }

  async function confirmDeleteCategory() {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteCategory(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const totalCategorized = categories.reduce((sum, category) => sum + category.postCount, 0);
  const mostUsed = categories.reduce<CategoryRow | null>((top, category) => (!top || category.postCount > top.postCount ? category : top), null);
  const emptyCount = categories.filter((category) => category.postCount === 0).length;

  return (
    <>
      <div className="wpage-stats">
        <div>
          <span>Total categories</span>
          <strong>{categories.length}</strong>
        </div>
        <div>
          <span>Posts categorized</span>
          <strong>{totalCategorized}</strong>
        </div>
        <div>
          <span>Most used</span>
          <strong>{mostUsed ? mostUsed.name : "—"}</strong>
        </div>
        <div>
          <span>Empty</span>
          <strong>{emptyCount}</strong>
        </div>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <p className="wtable-count">Every category used to group posts.</p>
          <div className="wtable-tools">
            <button type="button" className="wbtn wbtn-primary wbtn-add" onClick={openCreate}>
              New category
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
                <th>Category</th>
                <th>Description</th>
                <th>Posts</th>
                <th>Created</th>
                <th scope="col" className="wtable-actions-col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={5}>
                    No categories yet — create the first one to organize posts.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="wtable-user">
                        <i className="wdot" style={{ background: category.color }} />
                        <div>
                          <strong>{category.name}</strong>
                          <small>/blog/category/{category.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="wclamp">{category.description ?? "—"}</span>
                    </td>
                    <td>{category.postCount}</td>
                    <td className="wtable-date">{formatDate(category.createdAt)}</td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={() => openEdit(category)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="wbtn wbtn-danger-ghost wbtn-sm"
                          onClick={() => setPendingDelete(category)}
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
            <span className="wdialog-eyebrow">Blog / Categories</span>
            <h2>{kind === "edit" ? "Edit category" : "New category"}</h2>
          </div>
          <button type="button" className="wdialog-close" aria-label="Close" onClick={closeDialog}>
            ×
          </button>
        </div>
        <div className="wdialog-body">
          <div className="wform">
            <div className="wfield">
              <label htmlFor="category-name">Name</label>
              <input
                id="category-name"
                type="text"
                value={form.name}
                maxLength={60}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : previewSlug(name) }));
                }}
                placeholder="Category name"
              />
            </div>
            <div className="wfield">
              <label htmlFor="category-slug">
                Slug<span className="wfield-hint">edit for SEO control</span>
              </label>
              <input
                id="category-slug"
                type="text"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((prev) => ({ ...prev, slug: event.target.value }));
                }}
                placeholder="category-slug"
              />
            </div>
            <div className="wfield">
              <label htmlFor="category-description">
                Description<span className="wfield-hint">optional</span>
              </label>
              <textarea
                id="category-description"
                value={form.description}
                maxLength={200}
                rows={3}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description shown on category pages"
              />
            </div>
            <ColorField
              label="Color"
              value={form.color}
              onChange={(color) => setForm((prev) => ({ ...prev, color }))}
            />
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
          <button type="button" className="wbtn wbtn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? "Saving…" : kind === "edit" ? "Save changes" : "Create category"}
          </button>
        </div>
      </dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this category?"
        body={
          pendingDelete
            ? `"${pendingDelete.name}" is removed. ${pendingDelete.postCount} post(s) will become uncategorized but stay published.`
            : ""
        }
        confirmLabel="Delete category"
        busy={busy}
        onConfirm={confirmDeleteCategory}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
