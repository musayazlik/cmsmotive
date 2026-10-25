"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import ConfirmDialog from "../../../_components/confirm-dialog";
import { TextArea, TextField } from "../../../_components/ui";

export type ProductTypeRow = {
  id: string;
  key: string;
  name: string;
  pluralName: string;
  description: string | null;
  listPath: string | null;
  position: number;
  products: number;
  createdAt: string;
  updatedAt: string;
};

const API = "/api/admin/product-types";

/** Types tab: the kinds of product (theme, extension, …) shared by every store. */
export default function TypeManager({ types }: { types: ProductTypeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductTypeRow | null>(null);
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [name, setName] = useState("");
  const [pluralName, setPluralName] = useState("");
  const [description, setDescription] = useState("");
  const [listPath, setListPath] = useState("");
  const [position, setPosition] = useState("0");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductTypeRow | null>(null);

  const fresh = () => {
    setEditing(null);
    setKey("");
    setKeyTouched(false);
    setName("");
    setPluralName("");
    setDescription("");
    setListPath("");
    setPosition("0");
    setError("");
    setSaved("");
  };

  const startEdit = (type: ProductTypeRow) => {
    setEditing(type);
    setKey(type.key);
    setKeyTouched(true);
    setName(type.name);
    setPluralName(type.pluralName);
    setDescription(type.description ?? "");
    setListPath(type.listPath ?? "");
    setPosition(String(type.position));
    setError("");
    setSaved("");
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(editing ? `${API}/${editing.id}` : API, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name, pluralName, description, listPath, position: position.trim() === "" ? 0 : Number(position) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The type could not be saved.");
        return;
      }
      setSaved(editing ? "Type saved." : "Type created.");
      fresh();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      const response = await fetch(`${API}/${confirmDelete.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The type could not be deleted.");
      else {
        if (editing?.id === confirmDelete.id) fresh();
        setSaved("Type removed.");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="wform-stack">
      <form className="wfield-card" onSubmit={handleSubmit}>
        <div className="wmedia-head">
          <p className="wsection-label">{editing ? `Edit “${editing.name}”` : "Add a type"}</p>
          {editing ? (
            <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={fresh} disabled={saving}>
              New type
            </button>
          ) : null}
        </div>
        <div className="wform">
          <div className="wfield-row">
            <TextField
              id="pt-key"
              label="Key"
              value={key}
              onChange={(value) => {
                setKeyTouched(true);
                setKey(value);
              }}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={40}
              placeholder="theme"
              disabled={Boolean(editing)}
              note="Stable handle for URL filters (type=theme) and catalogue markers."
            />
            <TextField
              id="pt-name"
              label="Name"
              value={name}
              onChange={(value) => {
                setName(value);
                if (!keyTouched) setKey(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
              }}
              required
              maxLength={40}
              placeholder="Theme"
              note={editing ? undefined : "The key follows the name until you edit it."}
            />
            <TextField id="pt-plural" label="Plural name" value={pluralName} onChange={setPluralName} required maxLength={40} placeholder="Themes" />
          </div>
          <TextArea
            id="pt-description"
            label="Description"
            hint="optional"
            value={description}
            onChange={setDescription}
            rows={2}
            maxLength={300}
            placeholder="What this kind of product is, shown on its listing page intro."
          />
          <div className="wfield-row">
            <TextField
              id="pt-list-path"
              label="Listing page"
              hint="optional"
              value={listPath}
              onChange={setListPath}
              placeholder="/themes"
              note="Public page of this type; empty = /products?type=<key>."
            />
            <TextField id="pt-position" label="Sort order" value={position} onChange={setPosition} pattern="[0-9]*" note="Lower numbers come first in pickers." />
          </div>
        </div>
        <div className="wpub-actions">
          <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save type" : "Create type"}
          </button>
        </div>
        {error ? (
          <p className="wdialog-error wpost-feedback" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="wfield-hint-block wpost-feedback" role="status">
            {saved}
          </p>
        ) : null}
      </form>

      <div className="wfield-card">
        <p className="wsection-label">Existing types</p>
        {types.length === 0 ? (
          <p className="wrepeat-empty">No types yet. Every product needs one, so add the first kind above.</p>
        ) : (
          <div className="wrepeat wrepeat-table" role="table" aria-label="Product types">
            <div className="wrepeat-head" role="row">
              <span role="columnheader">Type</span>
              <span role="columnheader">Key</span>
              <span role="columnheader">Listing</span>
              <span role="columnheader">Products</span>
              <span aria-hidden="true" />
            </div>
            {types.map((type) => (
              <div className="wrepeat-row" role="row" key={type.id}>
                <span role="cell">
                  <strong>{type.name}</strong>
                  <small>{type.pluralName}</small>
                </span>
                <span role="cell">
                  <small className="status-slug">{type.key}</small>
                </span>
                <span role="cell">
                  <small>{type.listPath ?? `/products?type=${type.key}`}</small>
                </span>
                <span role="cell">
                  <span className={`wbadge ${type.products > 0 ? "wbadge-user" : "wbadge-missing"}`}>{type.products}</span>
                </span>
                <div className="wrepeat-tools">
                  <button type="button" onClick={() => startEdit(type)} aria-label={`Edit ${type.name}`}>
                    ✎
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => setConfirmDelete(type)}
                    disabled={type.products > 0}
                    aria-label={`Remove ${type.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="wfield-hint-block">Types are shared by every store. A type with products cannot be deleted; move its products first.</p>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Remove ${confirmDelete?.name ?? "type"}?`}
        body="Only types no product uses can be removed. The key stays reserved in URLs that already point at it."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
