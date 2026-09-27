"use client";

import { useMemo, useState } from "react";
import RichTextEditor from "./rich-text-editor";
import ImageField, { type UploadedImage } from "./image-field";
import { Select, TextArea, TextField } from "./ui";
import { EXTENSION_STATUSES, THEME_INDUSTRIES, THEME_STATUSES, VERSION_TARGETS } from "@/lib/catalog-guard";

type Props = {
  endpoint: "themeMedia" | "extensionMedia";
  api: string;
  redirectTo: string;
  /** Themes carry the extra industry / version target fields. */
  variant: "theme" | "extension";
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CatalogForm({ endpoint, api, redirectTo, variant }: Props) {
  const statuses = variant === "theme" ? THEME_STATUSES : EXTENSION_STATUSES;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>(statuses[0]);
  const [industry, setIndustry] = useState<string>(THEME_INDUSTRIES[0]);
  const [versionTarget, setVersionTarget] = useState<string>(VERSION_TARGETS[0]);
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [gallery, setGallery] = useState<UploadedImage[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedSlug = useMemo(() => (slugTouched ? slug : slugify(name)), [name, slug, slugTouched]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      name,
      slug: resolvedSlug,
      summary,
      description,
      status,
      coverId: cover[0]?.assetId ?? null,
      galleryIds: gallery.map((image) => image.assetId),
    };
    if (variant === "theme") {
      payload.industry = industry;
      payload.versionTarget = versionTarget;
    }

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The record could not be created.");
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="wform-card" onSubmit={handleSubmit}>
      <div className="wform-grid">
        <div className="wform-main">
          <TextField
            id="c-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Nordform"
            required
            minLength={2}
            maxLength={80}
          />

          <TextField
            id="c-slug"
            label="Slug"
            value={resolvedSlug}
            onChange={(value) => {
              setSlugTouched(true);
              setSlug(value);
            }}
            placeholder="nordform"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            note="Lowercase letters, numbers and hyphens. Generated from the name until you edit it."
          />

          {variant === "theme" ? (
            <div className="wfield-row">
              <Select
                id="c-industry"
                label="Industry"
                value={industry}
                onChange={setIndustry}
                options={THEME_INDUSTRIES}
              />
              <Select
                id="c-version"
                label="TYPO3 version target"
                value={versionTarget}
                onChange={setVersionTarget}
                options={VERSION_TARGETS}
              />
            </div>
          ) : null}

          <Select id="c-status" label="Status" value={status} onChange={setStatus} options={statuses} />

          <TextArea
            id="c-summary"
            label="Summary"
            variant="line"
            value={summary}
            onChange={setSummary}
            required
            minLength={10}
            maxLength={300}
            placeholder="One or two sentences used in the catalogue card."
          />

          <div className="wfield">
            <label htmlFor="c-description">Description</label>
            <RichTextEditor
              id="c-description"
              value={description}
              onChange={setDescription}
              placeholder="Describe what this product does, who it is for and what is included."
            />
          </div>
        </div>

        <aside className="wform-side">
          <ImageField endpoint={endpoint} label="Cover image" value={cover} onChange={setCover} hint="Shown on the catalogue card and detail page. Up to 8 MB." />
          <ImageField endpoint={endpoint} label="Gallery" multiple max={12} value={gallery} onChange={setGallery} hint="Up to 12 images, kept in the order shown here." />
        </aside>
      </div>

      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wform-foot">
        <a className="wbtn wbtn-ghost" href="/panel">Cancel</a>
        <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}
