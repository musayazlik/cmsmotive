import { getUploadSettings } from "@/lib/settings";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN } from "@/lib/upload-settings-shared";
import SettingsForm from "./_components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getUploadSettings();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> WORKSPACE / SETTINGS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Tune the <em>workspace.</em>
          </h1>
          <p>
            Workspace-wide defaults for how the panel handles media. Image uploads are optimized before they
            reach storage, so every theme, extension, post and library file benefits automatically.
          </p>
        </div>
        <span className="workspace-index">SETTINGS</span>
      </div>

      <SettingsForm settings={settings} />
      <p className="wsettings-scope">
        Quality range {WEBP_QUALITY_MIN}–{WEBP_QUALITY_MAX}. Applies to theme, extension, blog and media
        library uploads; existing files in storage keep their current format.
      </p>
    </>
  );
}
