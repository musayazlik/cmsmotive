"use client";

import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import { saveUploadSettingsAction } from "../_actions";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN, type UploadProvider, type UploadSettings } from "@/lib/upload-settings-shared";
import { EnvFacts, RangeField, SettingsFoot, useSettingsForm } from "./settings-kit";

type Availability = Record<UploadProvider, { configured: boolean; error: string }>;
const OPTIONS = [{ value: "uploadthing", label: "UploadThing" }, { value: "r2", label: "Cloudflare R2" }];
const FIELDS = [
  { key: "packageProvider", label: "Product files (ZIP)", note: "Private release packages downloaded by customers with a valid purchase." },
  { key: "imageProvider", label: "Images", note: "Product covers and galleries, blog images, generated images and library uploads." },
  { key: "videoProvider", label: "Videos", note: "Videos embedded in product descriptions, blog posts and the media library." },
] as const;

export default function MediaSettingsForm({ settings, availability }: { settings: UploadSettings; availability: Availability }) {
  const form = useSettingsForm(settings, saveUploadSettingsAction);
  const { values, set } = form;
  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Upload destinations</p>
        <p className="wfield-hint-block">Choose a service for each upload type in this store. New uploads use these choices; existing files keep their URLs and storage location.</p>
        {FIELDS.map(({ key, label, note }) => (
          <Select key={key} label={label} value={values[key]} onChange={(value) => set(key, value as UploadProvider)} options={OPTIONS} disabled={form.pending}
            note={key === "packageProvider" && values[key] === "uploadthing" ? `${note} Private ZIP uploads require a paid UploadThing plan.` : note}
            error={availability[values[key]].configured ? undefined : availability[values[key]].error} />
        ))}
        <EnvFacts facts={[
          { label: "UploadThing connection", value: availability.uploadthing.configured ? "Configured" : "Not configured", ok: availability.uploadthing.configured },
          { label: "Cloudflare R2 connection", value: availability.r2.configured ? "Configured" : "Not configured", ok: availability.r2.configured },
        ]} />
      </div>
      <div className="wsettings-section">
        <p className="wsection-label">Image optimization</p>
        <CheckBox checked={values.convertWebp} onChange={(value) => set("convertWebp", value)} label="Convert image uploads to WebP"
          note="Re-encodes jpg and png uploads in the browser before they are transferred. SVG, GIF and files that would only grow keep their original format." />
        {values.convertWebp ? (
          <RangeField label="WebP quality" value={values.webpQuality} onChange={(value) => set("webpQuality", value)} min={WEBP_QUALITY_MIN} max={WEBP_QUALITY_MAX} step={5} format={(value) => `${value}%`}
            note={values.webpQuality >= 90 ? "Near-lossless quality with smaller savings." : values.webpQuality >= 70 ? "Recommended balance of image quality and file size." : "Smallest files, visibly softer images."} />
        ) : null}
      </div>
      <SettingsFoot form={form} />
    </div>
  );
}
