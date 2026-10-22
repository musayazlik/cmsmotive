"use client";

import { useState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import { adminLoginPath, validateAdminAccessSettings, type AdminAccessSettings } from "@/lib/admin-access-shared";
import { saveAdminAccessSettingsAction } from "../_actions";
import { CopyButton, SettingsFoot, useSettingsForm } from "./settings-kit";

export default function SecuritySettingsForm({ settings, origin }: { settings: AdminAccessSettings; origin: string }) {
  const [password, setPassword] = useState("");
  const form = useSettingsForm(settings, async (values) => {
    const result = await saveAdminAccessSettingsAction({ ...values, currentPassword: password });
    if (result.ok) {
      setPassword("");
      window.location.replace(`${result.panelPath}/settings?tab=security`);
    }
    return result;
  }, { refresh: false });
  const candidate = validateAdminAccessSettings(form.values);
  const base = "data" in candidate ? candidate.data.panelPath : settings.panelPath;
  const login = `${origin}${adminLoginPath(base)}`;

  function generatePath() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    form.set("panelPath", `/workspace-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`);
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Panel address</p>
        <TextField label="Private panel path" value={form.values.panelPath} onChange={(value) => form.set("panelPath", value)} maxLength={65}
          error={form.dirty && "error" in candidate ? candidate.error : undefined}
          note="Choose a unique path. After saving, you move to the new address and the old /panel routes return 404. Save your new login address before continuing. Use /panel to restore the standard address." />
        <div className="wsettings-actions"><button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={generatePath}>Generate a private path</button></div>
        <dl className="wtoken-meta" style={{ marginTop: 20 }}>
          <div><dt>Login address after saving</dt><dd style={{ overflowWrap: "anywhere" }}>{login}</dd></div>
        </dl>
        <CopyButton value={login} label="Copy login address" />
        <TextField label="Current password" type="password" value={password} onChange={setPassword} autoComplete="current-password" maxLength={128}
          note="Confirm your identity before changing how the team accesses the panel." />
      </div>
      <div className="wsettings-section">
        <p className="wsection-label">Sign-in protection</p>
        <p className="wfield-hint-block" style={{ margin: 0 }}>A private address reduces automated discovery. Administrator sign-in requires a recent visit to your private login page, your password and a verified email. Every protected page and operation also checks the current account role.</p>
        <p className="wfield-hint-block">Sign-in is limited to 5 attempts per minute per IP. Public member sign-in remains available. Signed-out visitors are not shown your private address, and it is never added to robots.txt.</p>
      </div>
      <SettingsFoot form={{ ...form, dirty: form.dirty && "data" in candidate && Boolean(password) }} />
    </div>
  );
}
