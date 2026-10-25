"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import RichTextField from "../../_components/editor/rich-text-field";
import { CoverUpload, GalleryUpload, type UploadedImage } from "../../_components/catalog-media";
import { CompatibilityEditor, type CompatibilityDraft } from "../../_components/catalog-detail-fields";
import { Select, TextArea, TextField } from "../../_components/ui";
import type { ProductRecord, ProductTypeOption } from "../_record";

type Props = { record: ProductRecord; types: ProductTypeOption[] };

/**
 * General tab: what the product is and how its page looks. The essentials
 * come first; the detail-page extras (tagline, buttons, compatibility …) sit
 * in a collapsed section. Status, prices and packages have their own tabs.
 */
export default function ProductForm({ record, types }: Props) {
  const router = useRouter();
  const [name, setName] = useState(record.name);
  const [slug, setSlug] = useState(record.slug);
  const [summary, setSummary] = useState(record.summary);
  const [description, setDescription] = useState(record.description);
  const [typeId, setTypeId] = useState(record.typeId);
  const [category, setCategory] = useState(record.category);
  const [technologies, setTechnologies] = useState(record.technologies.join(", "));
  const [badge, setBadge] = useState(record.badge);
  const [position, setPosition] = useState(String(record.position));
  const [cover, setCover] = useState<UploadedImage | null>(record.cover);
  const [gallery, setGallery] = useState<UploadedImage[]>(record.gallery);
  const [tagline, setTagline] = useState(record.tagline);
  const [intro, setIntro] = useState(record.intro);
  const [highlights, setHighlights] = useState(record.highlights.join("\n"));
  const [ctaLabel, setCtaLabel] = useState(record.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(record.ctaUrl);
  const [demoUrl, setDemoUrl] = useState(record.demoUrl);
  const [compatibility, setCompatibility] = useState<CompatibilityDraft[]>(record.compatibility);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`/api/admin/products/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, slug, summary, description, typeId, category, technologies, badge,
          position: position.trim() === "" ? 0 : Number(position),
          coverId: cover?.assetId ?? null,
          galleryIds: gallery.map((image) => image.assetId),
          tagline, intro, highlights, ctaLabel, ctaUrl, demoUrl, compatibility,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The changes could not be saved.");
        return;
      }
      setSaved("Changes saved.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="wform-card" onSubmit={handleSubmit}>
      <div className="wform-grid">
        <div className="wform-main wform-stack">
          <div className="wfield-card">
            <p className="wsection-label">Basics</p>
            <div className="wform">
              <TextField id="p-name" label="Name" value={name} onChange={setName} required minLength={2} maxLength={80} />
              <TextField
                id="p-slug"
                label="Slug"
                value={slug}
                onChange={setSlug}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                note={`The page is /products/${slug || "slug"}. Changing it breaks links that were already shared.`}
              />
              <TextArea id="p-summary" label="Summary" variant="line" value={summary} onChange={setSummary} required minLength={10} maxLength={300} note="One or two sentences for the catalogue card." />
            </div>
          </div>

          <RichTextField
            id="p-description"
            label="Description"
            compact
            value={description}
            onChange={setDescription}
            placeholder="What the product does, who it is for and what is included."
          />

          <CoverUpload endpoint="productMedia" value={cover} onChange={setCover} />
          <GalleryUpload endpoint="productMedia" value={gallery} onChange={setGallery} />

          <details className="wfield-card wdisclosure">
            <summary className="wsection-label">Page details (optional)</summary>
            <div className="wform">
              <TextField id="p-tagline" label="Tagline" value={tagline} onChange={setTagline} maxLength={80} note="Small heading above the name. Empty = the category, else the type." />
              <TextArea id="p-intro" label="Intro" value={intro} onChange={setIntro} maxLength={400} rows={3} note="Paragraph under the name. Empty = the summary." />
              <TextArea id="p-highlights" label="Highlights" hint="one per line" value={highlights} onChange={setHighlights} rows={3} note="Short lines in the product box. Up to 8." />
              <div className="wfield-row">
                <TextField id="p-cta-label" label="Button label" value={ctaLabel} onChange={setCtaLabel} maxLength={40} placeholder={`Ask about ${name || "this product"}`} />
                <TextField id="p-cta-url" label="Button link" value={ctaUrl} onChange={setCtaUrl} placeholder="/contact or mailto:…" />
              </div>
              <p className="wfield-hint-block">The button shows while nothing can be bought yet.</p>
              <TextField id="p-demo-url" label="Demo link" value={demoUrl} onChange={setDemoUrl} placeholder="https://… or /demo-page" note="Adds a “View visual demo” button." />
              <CompatibilityEditor rows={compatibility} onChange={setCompatibility} />
            </div>
          </details>
        </div>

        <div className="wform-side">
          <div className="wfield-card">
            <p className="wsection-label">Catalogue card</p>
            <div className="wform">
              <Select id="p-type" label="Product type" value={typeId} onChange={setTypeId} options={types.map((type) => ({ value: type.id, label: type.name }))} />
              <TextField id="p-category" label="Category" hint="optional" value={category} onChange={setCategory} maxLength={80} placeholder="SaaS starter" note="Kicker above the name, e.g. an industry or use case. Empty = the type." />
              <TextField id="p-technologies" label="Technologies" hint="comma separated" value={technologies} onChange={setTechnologies} placeholder="Next.js 15, PostgreSQL" />
              <TextField id="p-badge" label="Badge" hint="optional" value={badge} onChange={setBadge} maxLength={40} placeholder="In development" note="Shown on previews instead of “Roadmap concept”." />
              <TextField id="p-position" label="Sort order" value={position} onChange={setPosition} pattern="[0-9]*" note="Lower numbers come first." />
            </div>
            <div className="wpub-actions">
              <button className="wbtn wbtn-primary wbtn-block" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
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
          </div>
        </div>
      </div>
    </form>
  );
}
