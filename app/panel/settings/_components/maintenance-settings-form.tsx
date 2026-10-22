"use client";

import Switch from "@/app/panel/_components/ui/switch";
import TextArea from "@/app/panel/_components/ui/text-area";
import TextField from "@/app/panel/_components/ui/text-field";
import { maintenancePage } from "@/lib/maintenance-page";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  DEFAULT_MAINTENANCE_TITLE,
  MAINTENANCE_LIMITS,
  type MaintenanceSettings,
} from "@/lib/maintenance-settings-shared";
import { saveMaintenanceSettingsAction } from "../_actions";
import { SettingsFoot, useSettingsForm } from "./settings-kit";

export default function MaintenanceSettingsForm({ settings }: { settings: MaintenanceSettings }) {
  const form = useSettingsForm(settings, saveMaintenanceSettingsAction);
  const { values, set } = form;

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <div className="wsettings-heading">
          <p className="wsection-label">Maintenance mode</p>
          <span className={`wbadge ${values.enabled ? "wbadge-pending" : "wbadge-verified"}`}>
            {values.enabled ? "Public pages offline" : "Site is open"}
          </span>
        </div>
        <Switch
          checked={values.enabled}
          onChange={(checked) => set("enabled", checked)}
          label="Show the maintenance page to visitors"
          note="Visitors see your maintenance message and can leave their email to hear when the site is back. The page checks for your return automatically. Your panel and signed-in access stay available."
        />
        {values.enabled ? (
          <p className="wdialog-error" role="alert" style={{ margin: 0 }}>
            Visitors see the maintenance page as soon as this is saved. Your signed-in team can continue reviewing the real site.
          </p>
        ) : null}
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Content of the maintenance page</p>
        <TextField
          label="Heading"
          value={values.title}
          onChange={(value) => set("title", value)}
          maxLength={MAINTENANCE_LIMITS.title}
          placeholder={DEFAULT_MAINTENANCE_TITLE}
          note={`Leave empty for the default. Up to ${MAINTENANCE_LIMITS.title} characters.`}
        />
        <TextArea
          label="Message"
          value={values.message}
          onChange={(text) => set("message", text)}
          rows={3}
          maxLength={MAINTENANCE_LIMITS.message}
          placeholder={DEFAULT_MAINTENANCE_MESSAGE}
          note="Shown under the heading. Say what is happening and when the site is expected back."
        />
        <div aria-label="Maintenance page preview">
          <p className="wfield-hint-block" style={{ margin: 0 }}>
            Preview your message and email signup below. Preview signups are disabled. Default text follows the
            visitor’s language; your custom heading and message are shown as written.
          </p>
          <iframe
            title="Maintenance page preview"
            srcDoc={maintenancePage(values, "en", { preview: true })}
            sandbox=""
            style={{ display: "block", width: "100%", height: 560, marginTop: 16, border: "1px solid var(--line)", borderRadius: 12 }}
          />
        </div>
      </div>

      <SettingsFoot form={form} />
    </div>
  );
}
