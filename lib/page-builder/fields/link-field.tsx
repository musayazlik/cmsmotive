"use client";

import { useId } from "react";
import { SAFE_HREF_PATTERN } from "../blocks/button/schema";

const COMMON_PRESETS = [
  { label: "Custom URL / Path", value: "" },
  { label: "Home (/)", value: "/" },
  { label: "Products (/products)", value: "/products" },
  { label: "Blog (/blog)", value: "/blog" },
  { label: "Contact (/contact)", value: "/contact" },
  { label: "Pricing (/pricing)", value: "/pricing" },
  { label: "About (/about)", value: "/about" },
];

export function LinkField({
  value = "",
  onChange,
  label = "Link URL",
}: {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  const isSafe = !value || SAFE_HREF_PATTERN.test(value);

  return (
    <div className="pb-field-group" style={{ display: "grid", gap: 6, margin: "6px 0" }}>
      <label htmlFor={id} style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-muted)" }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or /path or #anchor"
          style={{
            flex: 1,
            minWidth: 160,
            padding: "6px 10px",
            fontSize: "0.85rem",
            border: `1px solid ${isSafe ? "var(--line, #cbd2d3)" : "var(--warn, #b3372a)"}`,
            borderRadius: 6,
            background: "var(--surface, #fff)",
          }}
        />
        <select
          aria-label="Preset URLs"
          value={COMMON_PRESETS.some((p) => p.value === value && p.value !== "") ? value : ""}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          style={{
            padding: "6px 8px",
            fontSize: "0.82rem",
            border: "1px solid var(--line, #cbd2d3)",
            borderRadius: 6,
            background: "var(--surface, #fff)",
            cursor: "pointer",
          }}
        >
          {COMMON_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      {!isSafe && (
        <span style={{ fontSize: "0.75rem", color: "var(--warn, #b3372a)" }}>
          Invalid URL pattern. Use https://, http://, /path, mailto:, or #anchor.
        </span>
      )}
    </div>
  );
}
