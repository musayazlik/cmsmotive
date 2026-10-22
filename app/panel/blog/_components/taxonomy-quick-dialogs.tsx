"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useEffect, useRef, useState } from "react";
import ColorField from "./color-field";
import { saveCategory, saveTag } from "../_actions";
import { slugify } from "@/lib/slug";

/**
 * Quick "new category" / "new tag" dialogs for the post form, mirroring the
 * create dialogs on the categories and tags pages. Each dialog owns its
 * form state; the post form only mounts it while open and receives the
 * created row, so every opening starts from a fresh form.
 */

const EMPTY_CATEGORY_FORM = { name: "", slug: "", description: "", color: "#4353e8" };
const EMPTY_TAG_FORM = { name: "", slug: "" };

type QuickDialogProps = {
  onClose: () => void;
  /** Called with the created row so the form can select and extend its options. */
  onCreated: (id: string, name: string) => void;
};

export function CategoryQuickDialog({ onClose, onCreated }: QuickDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    const result = await saveCategory({
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
    onClose();
    if (result.id && result.name) onCreated(result.id, result.name);
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      className="wdialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Blog / Categories</span>
          <h2>New category</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close" onClick={onClose}>
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
                setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
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
        <button type="button" className="wbtn wbtn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="wbtn wbtn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : "Create category"}
        </button>
      </div>
    </dialog>
  );
}

export function TagQuickDialog({ onClose, onCreated }: QuickDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY_TAG_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    const result = await saveTag({ name: form.name, slug: form.slug });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    if (result.id && result.name) onCreated(result.id, result.name);
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      className="wdialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Blog / Tags</span>
          <h2>New tag</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close" onClick={onClose}>
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
                setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
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
        <button type="button" className="wbtn wbtn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="wbtn wbtn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : "Create tag"}
        </button>
      </div>
    </dialog>
  );
}
