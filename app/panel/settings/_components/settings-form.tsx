"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import { saveUploadSettingsAction } from "../_actions";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN, type UploadSettings } from "@/lib/upload-settings-shared";

export default function SettingsForm({ settings }: { settings: UploadSettings }) {
  const router = useRouter();
  const [convertWebp, setConvertWebp] = useState(settings.convertWebp);
  const [webpQuality, setWebpQuality] = useState(settings.webpQuality);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const dirty = convertWebp !== settings.convertWebp || webpQuality !== settings.webpQuality;

  function save() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await saveUploadSettingsAction(convertWebp, webpQuality);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Image optimization</p>
        <CheckBox
          checked={convertWebp}
          onChange={setConvertWebp}
          label="Convert image uploads to WebP"
          note="Re-encodes jpg and png uploads in the browser before they are transferred. SVG, GIF and files that would only grow keep their original format."
        />

        {convertWebp ? (
          <div className="wsettings-quality">
            <label htmlFor="webp-quality">WebP quality</label>
            <div className="wsettings-quality-row">
              <input
                id="webp-quality"
                type="range"
                min={WEBP_QUALITY_MIN}
                max={WEBP_QUALITY_MAX}
                step={5}
                value={webpQuality}
                onChange={(event) => setWebpQuality(Number(event.target.value))}
              />
              <output className="wsettings-quality-value" htmlFor="webp-quality">
                {webpQuality}%
              </output>
            </div>
            <p className="wfield-hint-block">
              {webpQuality >= 90
                ? "Near-lossless quality with smaller savings."
                : webpQuality >= 70
                  ? "Recommended balance of image quality and file size."
                  : "Smallest files, visibly softer images."}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="wdialog-error" role="alert" style={{ margin: "0 19px 4px" }}>
          {error}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {saved && !dirty ? "Settings saved." : ""}
        </span>
        <button type="button" className="wbtn wbtn-primary" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
