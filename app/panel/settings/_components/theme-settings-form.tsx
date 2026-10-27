"use client";

import TextField from "@/app/panel/_components/ui/text-field";
import type { ThemeSettings } from "@/lib/theme-settings-shared";
import { saveThemeSettingsAction } from "../_actions";
import { SettingsFoot, useSettingsForm } from "./settings-kit";

export default function ThemeSettingsForm({ settings }: { settings: ThemeSettings }) {
  const form = useSettingsForm(settings, saveThemeSettingsAction);
  const { values, set } = form;

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Brand Colors</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div>
            <TextField
              label="Primary / Brand color"
              value={values.primaryColor}
              onChange={(value) => set("primaryColor", value)}
              note="Maps to --indigo and button colors."
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="color"
                value={values.primaryColor}
                onChange={(e) => set("primaryColor", e.target.value)}
                style={{ width: 36, height: 28, border: "none", cursor: "pointer", background: "none" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{values.primaryColor}</span>
            </div>
          </div>

          <div>
            <TextField
              label="Canvas background"
              value={values.canvasColor}
              onChange={(value) => set("canvasColor", value)}
              note="Maps to --canvas (page background)."
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="color"
                value={values.canvasColor}
                onChange={(e) => set("canvasColor", e.target.value)}
                style={{ width: 36, height: 28, border: "none", cursor: "pointer", background: "none" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{values.canvasColor}</span>
            </div>
          </div>

          <div>
            <TextField
              label="Surface / Card background"
              value={values.surfaceColor}
              onChange={(value) => set("surfaceColor", value)}
              note="Maps to --surface."
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="color"
                value={values.surfaceColor}
                onChange={(e) => set("surfaceColor", e.target.value)}
                style={{ width: 36, height: 28, border: "none", cursor: "pointer", background: "none" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{values.surfaceColor}</span>
            </div>
          </div>

          <div>
            <TextField
              label="Text / Ink color"
              value={values.inkColor}
              onChange={(value) => set("inkColor", value)}
              note="Maps to --ink."
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="color"
                value={values.inkColor}
                onChange={(e) => set("inkColor", e.target.value)}
                style={{ width: 36, height: 28, border: "none", cursor: "pointer", background: "none" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{values.inkColor}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Geometry & Typography</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <TextField
            label="Corner radius"
            value={values.radius}
            onChange={(value) => set("radius", value)}
            note="Default element corner radius (e.g. 14px or 1rem). Maps to --radius."
          />
          <TextField
            label="Sans font family"
            value={values.fontSans}
            onChange={(value) => set("fontSans", value)}
            note="Primary typography family (e.g. Manrope)."
          />
          <TextField
            label="Mono font family"
            value={values.fontMono}
            onChange={(value) => set("fontMono", value)}
            note="Monospace typography family (e.g. DM Mono)."
          />
        </div>
      </div>

      <SettingsFoot form={form} />
    </div>
  );
}
