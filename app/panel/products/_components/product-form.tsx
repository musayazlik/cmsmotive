"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import { PRODUCT_STATUSES } from "@/lib/catalog-guard";
import { DEFAULT_COMPLIANCE } from "@/lib/product-compliance";
import ConfirmDialog from "../../_components/confirm-dialog";
import RichTextField from "../../_components/editor/rich-text-field";
import { CoverUpload, GalleryUpload, type UploadedImage } from "../../_components/catalog-media";
import { CompatibilityEditor, type CompatibilityDraft } from "../../_components/catalog-detail-fields";
import ProductComplianceFields from "../../_components/product-compliance-fields";
import { MultiSelect, Select, TextArea, TextField } from "../../_components/ui";
import type { ProductRecord, ProductTypeOption, StoreOption } from "../_record";

type Props = {
  /** The product to edit; omitted on the create page. */
  record?: ProductRecord;
  types: ProductTypeOption[];
  stores: StoreOption[];
  /** The store the panel is editing; new products are owned and listed there. */
  storeId: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Create and edit form for products: content, detail page, media, publishing, stores and the release checklist. */
export default function ProductForm({ record, types, stores, storeId }: Props) {
  const router = useRouter();
  const api = "/api/admin/products";
  const listHref = "/panel/products";
  const mediaEditable = !record || record.ownedHere;

  const [compliance, setCompliance] = useState(record?.compliance ?? DEFAULT_COMPLIANCE);
  const [name, setName] = useState(record?.name ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  // A new record's slug follows its name until edited; an existing slug is never rewritten.
  const [slugTouched, setSlugTouched] = useState(Boolean(record));
  const [summary, setSummary] = useState(record?.summary ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [typeId, setTypeId] = useState(record?.typeId ?? types[0]?.id ?? "");
  const [status, setStatus] = useState<string>(record?.status ?? PRODUCT_STATUSES[0]);
  const [storeIds, setStoreIds] = useState<string[]>(record?.storeIds ?? [storeId]);
  const [category, setCategory] = useState(record?.category ?? "");
  const [technologies, setTechnologies] = useState((record?.technologies ?? []).join(", "));
  const [listPrice, setListPrice] = useState(record?.listPrice === null || record?.listPrice === undefined ? "" : String(record.listPrice));
  const [position, setPosition] = useState(String(record?.position ?? 0));
  const [tagline, setTagline] = useState(record?.tagline ?? "");
  const [intro, setIntro] = useState(record?.intro ?? "");
  const [highlights, setHighlights] = useState((record?.highlights ?? []).join("\n"));
  const [ctaLabel, setCtaLabel] = useState(record?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(record?.ctaUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(record?.demoUrl ?? "");
  const [compatibility, setCompatibility] = useState<CompatibilityDraft[]>(record?.compatibility ?? []);
  const [cover, setCover] = useState<UploadedImage | null>(record?.cover ?? null);
  const [gallery, setGallery] = useState<UploadedImage[]>(record?.gallery ?? []);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolvedSlug = slugTouched ? slug : slugify(name);
  const ownerStore = record && !record.ownedHere ? stores.find((store) => record.storeIds.includes(store.id) && store.id !== storeId) : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    const payload: Record<string, unknown> = {
      name,
      slug: resolvedSlug,
      summary,
      description,
      typeId,
      status,
      storeIds,
      category,
      technologies,
      listPrice: listPrice.trim() === "" ? null : Number(listPrice),
      position: position.trim() === "" ? 0 : Number(position),
      tagline,
      intro,
      highlights,
      ctaLabel,
      ctaUrl,
      demoUrl,
      compatibility,
      compliance,
      coverId: cover?.assetId ?? null,
      galleryIds: gallery.map((image) => image.assetId),
    };
    try {
      const response = await fetch(record ? `${api}/${record.id}` : api, {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? (record ? "The changes could not be saved." : "The product could not be created."));
        return;
      }
      if (record) {
        setSaved("Changes saved.");
        router.refresh();
      } else {
        // A new product continues on its edit page, where prices and releases are added.
        router.push(`/panel/products/${data.id}?tab=pricing`);
      }
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
        setError(data.error ?? "The product could not be deleted.");
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
          <Link className="wbtn wbtn-ghost" href={listHref}>
            ← Back to products
          </Link>
          {record ? (
            <div className="wpost-toolbar-actions">
              <a className="wbtn wbtn-ghost" href={`/products/${record.slug}`} target="_blank" rel="noreferrer">
                View on site ↗
              </a>
              {record.ownedHere ? (
                <button type="button" className="wbtn wbtn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Delete product
                </button>
              ) : null}
            </div>
          ) : null}
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

        <div className="wform-grid">
          <div className="wform-main wform-stack">
            <div className="wfield-card">
              <p className="wsection-label">Details</p>
              <div className="wform">
                <TextField id="p-name" label="Name" value={name} onChange={setName} placeholder="Nordform" required minLength={2} maxLength={80} />
                <TextField
                  id="p-slug"
                  label="Slug"
                  value={resolvedSlug}
                  onChange={(value) => {
                    setSlugTouched(true);
                    setSlug(value);
                  }}
                  placeholder="nordform"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  note={
                    record
                      ? "The product page is /products/<slug> in every store that lists it, so change it with care."
                      : "Lowercase letters, numbers and hyphens. Generated from the name until you edit it."
                  }
                />
                <TextArea
                  id="p-summary"
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
                  id="p-tagline"
                  label="Tagline"
                  hint="optional"
                  value={tagline}
                  onChange={setTagline}
                  maxLength={80}
                  placeholder="The featured concept"
                  note="Small heading above the name. Empty = the category, else the product type."
                />
                <TextArea id="p-intro" label="Intro" hint="optional" value={intro} onChange={setIntro} maxLength={400} rows={3} placeholder="One or two sentences under the name. Empty = the summary." />
                <TextArea
                  id="p-highlights"
                  label="Highlights"
                  hint="one per line"
                  value={highlights}
                  onChange={setHighlights}
                  rows={3}
                  placeholder={"Visual demo available now\nFinal package specification pending"}
                  note="Short lines listed in the product box. Up to 8."
                />
                <div className="wfield-row">
                  <TextField id="p-cta-label" label="Button label" hint="optional" value={ctaLabel} onChange={setCtaLabel} maxLength={40} placeholder={`Ask about ${name || "this product"}`} />
                  <TextField id="p-cta-url" label="Button link" hint="optional" value={ctaUrl} onChange={setCtaUrl} placeholder="/contact or mailto:…" />
                </div>
                <TextField
                  id="p-demo-url"
                  label="Demo link"
                  hint="optional"
                  value={demoUrl}
                  onChange={setDemoUrl}
                  placeholder="/demo-nordform or https://…"
                  note="Adds a “View visual demo” button. The button above is shown while nothing can be bought yet."
                />
              </div>
            </div>

            <RichTextField
              id="p-description"
              label="Description"
              compact
              value={description}
              onChange={setDescription}
              placeholder="Describe what this product does, who it is for and what is included."
            />

            <CompatibilityEditor rows={compatibility} onChange={setCompatibility} />
            {mediaEditable ? (
              <>
                <CoverUpload endpoint="productMedia" value={cover} onChange={setCover} />
                <GalleryUpload endpoint="productMedia" value={gallery} onChange={setGallery} />
              </>
            ) : (
              <div className="wfield-card">
                <p className="wsection-label">Media</p>
                <p className="wfield-hint-block">
                  Cover and gallery come from the media library of {ownerStore?.name ?? "the store that owns this product"}. Switch to that store to change them.
                </p>
              </div>
            )}
          </div>

          <div className="wform-side">
            <div className="wfield-card">
              <p className="wsection-label">Publishing</p>
              <div className="wform">
                <Select
                  id="p-type"
                  label="Product type"
                  value={typeId}
                  onChange={setTypeId}
                  options={types.map((type) => ({ value: type.id, label: type.name }))}
                  note={types.length ? undefined : "Create a product type first under Products → Types."}
                />
                <Select id="p-status" label="Status" value={status} onChange={setStatus} options={PRODUCT_STATUSES} />
                <TextField id="p-position" label="Sort order" value={position} onChange={setPosition} pattern="[0-9]*" note="Lower numbers come first in this store's catalogue." />
                {stores.length > 1 ? (
                  <MultiSelect
                    id="p-stores"
                    label="Listed in stores"
                    value={storeIds}
                    onChange={(next) => setStoreIds(next.length ? next : [storeId])}
                    options={stores.map((store) => ({ value: store.id, label: store.name }))}
                    note="Prices are set per store on the Pricing tab. The owning store always lists the product."
                  />
                ) : null}
              </div>
              <div className="wpub-actions">
                <button className="wbtn wbtn-primary wbtn-block" type="submit" disabled={saving || !typeId}>
                  {saving ? "Saving…" : record ? "Save changes" : "Create product"}
                </button>
                <Link className="wbtn wbtn-ghost wbtn-block" href={listHref}>
                  Cancel
                </Link>
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

            <div className="wfield-card">
              <p className="wsection-label">Catalogue card</p>
              <div className="wform">
                <TextField id="p-category" label="Category" hint="optional" value={category} onChange={setCategory} maxLength={80} placeholder="Architecture & corporate" note="Kicker above the name, e.g. an industry. Empty = the product type." />
                <TextField
                  id="p-technologies"
                  label="Technologies"
                  hint="comma separated"
                  value={technologies}
                  onChange={setTechnologies}
                  placeholder="TYPO3 13, TYPO3 14"
                  note="Shown as a badge; versions feed the catalogue filters."
                />
                <TextField
                  id="p-list-price"
                  label="Indicative price"
                  hint="optional"
                  value={listPrice}
                  onChange={setListPrice}
                  pattern="[0-9]*"
                  placeholder="269"
                  note="Whole units, shown only while the product has no prices. 0 = free, empty = not decided."
                />
              </div>
            </div>

            {record ? (
              <div className="wfield-card">
                <p className="wsection-label">On the detail page</p>
                <div className="wlinks">
                  <Link className="wlink-row" href={`/panel/changelog?product=${record.id}`}>
                    <span>
                      <strong>Changelog</strong>
                      <small>
                        {record.counts.changelog} {record.counts.changelog === 1 ? "entry" : "entries"}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link className="wlink-row" href={`/panel/reviews?product=${record.id}`}>
                    <span>
                      <strong>Reviews</strong>
                      <small>
                        {record.counts.reviews} total · {record.counts.pendingReviews} awaiting approval
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link className="wlink-row" href={`/panel/sales/orders?product=${record.id}`}>
                    <span>
                      <strong>Orders</strong>
                      <small>{record.counts.orders} total</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ) : null}

            <ProductComplianceFields value={compliance} onChange={setCompliance} />
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${record?.name ?? "product"}?`}
        body="The product, its prices, releases, gallery links, changelog and reviews are permanently removed. Products with orders cannot be deleted. The images stay in the media library."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
