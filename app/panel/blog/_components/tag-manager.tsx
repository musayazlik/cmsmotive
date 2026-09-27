"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import { deleteTag, saveTag } from "../_actions";
import type { TagRow } from "../_lib";

type DialogKind = "create" | "edit" | null;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function previewSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TagManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<DialogKind>(null);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [form, setForm] = useState({ name: "", slug: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TagRow | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", slug: "" });
    setSlugTouched(false);
    setError("");
    setKind("create");
  }

  function openEdit(tag: TagRow) {
    setEditing(tag);
    setForm({ name: tag.name, slug: tag.slug });
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
    const result = await saveTag({ id: editing?.id, name: form.name, slug: form.slug });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeDialog();
    router.refresh();
  }

  async function confirmDeleteTag() {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteTag(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const totalUsage = tags.reduce((sum, tag) => sum + tag.postCount, 0);
  const mostUsed = tags.reduce<TagRow | null>((top, tag) => (!top || tag.postCount > top.postCount ? tag : top), null);
  const emptyCount = tags.filter((tag) => tag.postCount === 0).length;

  return (
    <>
      <div className="wpage-stats">
        <div>
          <span>Total tags</span>
          <strong>{tags.length}</strong>
        </div>
        <div>
          <span>Tagged posts</span>
          <strong>{totalUsage}</strong>
        </div>
        <div>
          <span>Most used</span>
          <strong>{mostUsed ? mostUsed.name : "—"}</strong>
        </div>
        <div>
          <span>Unused</span>
          <strong>{emptyCount}</strong>
        </div>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <p className="wtable-count">Fine-grained labels a post can carry many of.</p>
          <div className="wtable-tools">
            <button type="button" className="wbtn wbtn-primary wbtn-add" onClick={openCreate}>
              New tag
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
                <th>Tag</th>
                <th>Posts</th>
                <th>Created</th>
                <th className="wtable-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={4}>
                    No tags yet — create the first one or add them inline while writing a post.
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <div className="wtable-user">
                        <span className="wtable-avatar" aria-hidden="true">
                          #
                        </span>
                        <div>
                          <strong>{tag.name}</strong>
                          <small>{tag.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>{tag.postCount}</td>
                    <td className="wtable-date">{formatDate(tag.createdAt)}</td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={() => openEdit(tag)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="wbtn wbtn-danger-ghost wbtn-sm"
                          onClick={() => setPendingDelete(tag)}
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
            <span className="wdialog-eyebrow">Blog / Tags</span>
            <h2>{kind === "edit" ? "Edit tag" : "New tag"}</h2>
          </div>
          <button type="button" className="wdialog-close" aria-label="Close" onClick={closeDialog}>
            ×
          </button>
        </div>
        <div className="wdialog-body">
          <div className="wform">
            <div className="wfield">
              <label htmlFor="tag-name">Name</label>
              <input
                id="tag-name"
                type="text"
                value={form.name}
                maxLength={40}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : previewSlug(name) }));
                }}
                placeholder="Tag name"
              />
            </div>
            <div className="wfield">
              <label htmlFor="tag-slug">
                Slug<span className="wfield-hint">edit for SEO control</span>
              </label>
              <input
                id="tag-slug"
                type="text"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((prev) => ({ ...prev, slug: event.target.value }));
                }}
                placeholder="tag-slug"
              />
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
          <button type="button" className="wbtn wbtn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? "Saving…" : kind === "edit" ? "Save changes" : "Create tag"}
          </button>
        </div>
      </dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this tag?"
        body={pendingDelete ? `"${pendingDelete.name}" is removed from ${pendingDelete.postCount} post(s). The posts stay published.` : ""}
        confirmLabel="Delete tag"
        busy={busy}
        onConfirm={confirmDeleteTag}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
