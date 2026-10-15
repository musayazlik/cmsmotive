"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RichTextEditor from "./editor/rich-text-editor";
import ConfirmDialog from "./confirm-dialog";
import { CoverUpload, GalleryUpload } from "./catalog-media";
import { CompatibilityEditor, LicenceEditor, type CompatibilityDraft, type LicenceDraft } from "./catalog-detail-fields";
import { Select, TextArea, TextField } from "./ui";
import type { CatalogRecord, UploadedImage } from "./catalog-record";
import { EXTENSION_STATUSES, THEME_INDUSTRIES, THEME_STATUSES, VERSION_TARGETS } from "@/lib/catalog-guard";

type Props = {
  /** Themes carry the extra industry, version target and price fields. */
  variant: "theme" | "extension";
  /** The record to edit; omitted on the create page. */
  record?: CatalogRecord;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

/** Create and edit page form for themes and extensions. */
export default function CatalogForm({ variant, record }: Props) {
  const router = useRouter();
  const statuses = variant === "theme" ? THEME_STATUSES : EXTENSION_STATUSES;
  const api = `/api/admin/${variant}s`;
  const listHref = `/panel/${variant}s`;
  const endpoint = variant === "theme" ? "themeMedia" : "extensionMedia";

  const [name, setName] = useState(record?.name ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  // A new record's slug follows its name until edited; an existing slug is never rewritten.
  const [slugTouched, setSlugTouched] = useState(Boolean(record));
  const [summary, setSummary] = useState(record?.summary ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [status, setStatus] = useState<string>(record?.status ?? statuses[0]);
  const [industry, setIndustry] = useState<string>(record?.industry || THEME_INDUSTRIES[0]);
  const [versionTarget, setVersionTarget] = useState<string>(record?.versionTarget || VERSION_TARGETS[0]);
  const [price, setPrice] = useState(record?.price === null || record?.price === undefined ? "" : String(record.price));
  const [position, setPosition] = useState(String(record?.position ?? 0));
  const [tagline, setTagline] = useState(record?.tagline ?? "");
  const [intro, setIntro] = useState(record?.intro ?? "");
  const [highlights, setHighlights] = useState((record?.highlights ?? []).join("\n"));
  const [ctaLabel, setCtaLabel] = useState(record?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(record?.ctaUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(record?.demoUrl ?? "");
  const [compatibility, setCompatibility] = useState<CompatibilityDraft[]>(record?.compatibility ?? []);
  const [licences, setLicences] = useState<LicenceDraft[]>(
    (record?.licences ?? []).map((licence) => ({ name: licence.name, price: String(licence.price) })),
  );
  const [cover, setCover] = useState<UploadedImage | null>(record?.cover ?? null);
  const [gallery, setGallery] = useState<UploadedImage[]>(record?.gallery ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolvedSlug = slugTouched ? slug : slugify(name);

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
      position: position.trim() === "" ? 0 : Number(position),
      tagline,
      intro,
      highlights,
      ctaLabel,
      ctaUrl,
      demoUrl,
      compatibility,
      coverId: cover?.assetId ?? null,
      galleryIds: gallery.map((image) => image.assetId),
    };
    if (variant === "theme") {
      payload.industry = industry;
      payload.versionTarget = versionTarget;
      payload.price = price.trim() === "" ? null : Number(price);
      payload.licences = licences;
    }

    try {
      const response = await fetch(record ? `${api}/${record.id}` : api, {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? (record ? "The changes could not be saved." : "The record could not be created."));
        return;
      }
      router.push(listHref);
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
      const response = await fetch(`${api}/${record.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? `The ${variant} could not be deleted.`);
        return;
      }
      router.push(listHref);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <form className="wform-card" onSubmit={handleSubmit}>
        <div className="wpost-toolbar">
          <a className="wbtn wbtn-ghost" href={listHref}>
            ← Back to {variant}s
          </a>
          {record ? (
            <div className="wpost-toolbar-actions">
              <a className="wbtn wbtn-ghost" href={`/${variant}/${record.slug}`} target="_blank" rel="noreferrer">
                View on site ↗
              </a>
              <button type="button" className="wbtn wbtn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Delete {variant}
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
              <p className="wsection-label">Details</p>
              <div className="wform">
                <TextField
                  id="c-name"
                  label="Name"
                  value={name}
                  onChange={setName}
                  placeholder={variant === "theme" ? "Nordform" : "Editorial Workflow"}
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
                  placeholder={variant === "theme" ? "nordform" : "editorial-workflow"}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  note={
                    record
                      ? "Lowercase letters, numbers and hyphens. Site links and anchors use it, so change it with care."
                      : "Lowercase letters, numbers and hyphens. Generated from the name until you edit it."
                  }
                />
                <TextArea
                  id="c-summary"
                  label="Summary"
                  variant="line"
                  value={summary}
                  onChange={setSummary}
                  required
                  minLength={10}
                  maxLength={300}
                  placeholder="One or two sentences used on the catalogue card."
                />
              </div>
            </div>

            <div className="wfield-card">
              <p className="wsection-label">Detail page</p>
              <div className="wform">
                <TextField
                  id="c-tagline"
                  label="Tagline"
                  hint="optional"
                  value={tagline}
                  onChange={setTagline}
                  maxLength={80}
                  placeholder={variant === "theme" ? "The featured concept" : "Workflow extension"}
                  note={`Small heading above the name on /${variant}/${resolvedSlug || "slug"}. Empty = ${variant === "theme" ? "the industry" : "“Extension”"}.`}
                />
                <TextArea
                  id="c-intro"
                  label="Intro"
                  hint="optional"
                  value={intro}
                  onChange={setIntro}
                  maxLength={400}
                  rows={3}
                  placeholder="One or two sentences under the name. Empty = the summary."
                />
                <TextArea
                  id="c-highlights"
                  label="Highlights"
                  hint="one per line"
                  value={highlights}
                  onChange={setHighlights}
                  rows={3}
                  placeholder={"Visual demo available now\nFinal package specification pending"}
                  note="Short lines listed under the buttons in the product box. Up to 8."
                />
                <div className="wfield-row">
                  <TextField
                    id="c-cta-label"
                    label="Button label"
                    hint="optional"
                    value={ctaLabel}
                    onChange={setCtaLabel}
                    maxLength={40}
                    placeholder={`Ask about ${name || "this product"}`}
                  />
                  <TextField
                    id="c-cta-url"
                    label="Button link"
                    hint="optional"
                    value={ctaUrl}
                    onChange={setCtaUrl}
                    placeholder="/contact or mailto:…"
                  />
                </div>
                <TextField
                  id="c-demo-url"
                  label="Demo link"
                  hint="optional"
                  value={demoUrl}
                  onChange={setDemoUrl}
                  placeholder="/demo-nordform or https://…"
                  note="Adds a “View visual demo” button. Site paths, https:// and mailto: links work."
                />
              </div>
            </div>

            <div className="wfield-editor is-compact">
              <p className="wsection-label">Description</p>
              <RichTextEditor
                id="c-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe what this product does, who it is for and what is included."
              />
            </div>

            <CompatibilityEditor rows={compatibility} onChange={setCompatibility} />
            <CoverUpload endpoint={endpoint} value={cover} onChange={setCover} />
            <GalleryUpload endpoint={endpoint} value={gallery} onChange={setGallery} />
          </div>

          <div className="wform-side">
            <div className="wfield-card">
              <p className="wsection-label">Publishing</p>
              <div className="wform">
                <Select id="c-status" label="Status" value={status} onChange={setStatus} options={statuses} />
                <TextField
                  id="c-position"
                  label="Sort order"
                  value={position}
                  onChange={setPosition}
                  pattern="[0-9]*"
                  note={`Lower numbers come first on the home page and /${variant}s.`}
                />
              </div>
              <div className="wpub-actions">
                <button className="wbtn wbtn-primary wbtn-block" type="submit" disabled={saving}>
                  {saving ? "Saving…" : record ? "Save changes" : `Create ${variant}`}
                </button>
                <a className="wbtn wbtn-ghost wbtn-block" href={listHref}>
                  Cancel
                </a>
              </div>
              {record ? (
                <dl className="wpub-status">
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(record.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last saved</dt>
                    <dd>{formatDate(record.updatedAt)}</dd>
                  </div>
                </dl>
              ) : null}
            </div>

            {record ? (
              <div className="wfield-card">
                <p className="wsection-label">On the detail page</p>
                <div className="wlinks">
                  <a className="wlink-row" href={`/panel/changelog?product=${variant}:${record.id}`}>
                    <span>
                      <strong>Changelog</strong>
                      <small>
                        {record.counts.changelog} {record.counts.changelog === 1 ? "entry" : "entries"}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </a>
                  <a className="wlink-row" href={`/panel/changelog/new?product=${variant}:${record.id}`}>
                    <span>
                      <strong>Add a changelog entry</strong>
                      <small>Preselects {record.name}</small>
                    </span>
                    <span aria-hidden="true">+</span>
                  </a>
                  <a className="wlink-row" href={`/panel/reviews?product=${variant}:${record.id}`}>
                    <span>
                      <strong>Reviews</strong>
                      <small>
                        {record.counts.reviews} total · {record.counts.pendingReviews} awaiting approval
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            ) : null}

            {variant === "theme" ? (
              <div className="wfield-card">
                <p className="wsection-label">Catalogue card</p>
                <div className="wform">
                  <Select id="c-industry" label="Industry" value={industry} onChange={setIndustry} options={THEME_INDUSTRIES} />
                  <Select
                    id="c-version"
                    label="TYPO3 version target"
                    value={versionTarget}
                    onChange={setVersionTarget}
                    options={VERSION_TARGETS}
                  />
                  <TextField
                    id="c-price"
                    label="Price (EUR)"
                    value={price}
                    onChange={setPrice}
                    placeholder="269"
                    pattern="[0-9]*"
                    note="Shown on the catalogue card. 0 = free, empty = not decided yet."
                  />
                </div>
              </div>
            ) : null}

            {variant === "theme" ? <LicenceEditor rows={licences} onChange={setLicences} /> : null}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${record?.name ?? variant}?`}
        body="The record and its gallery will be permanently removed. The uploaded images stay in the media library. This cannot be undone."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
