"use client";
import TextField from "./ui/text-field";
import TextArea from "./ui/text-area";
import Switch from "./ui/switch";
import {
  publicationMissingLabels,
  type ProductCompliance,
} from "@/lib/product-compliance";
export default function ProductComplianceFields({
  value,
  onChange,
}: {
  value: ProductCompliance;
  onChange: (v: ProductCompliance) => void;
}) {
  const set = <K extends keyof ProductCompliance>(
    key: K,
    v: ProductCompliance[K],
  ) => onChange({ ...value, [key]: v });
  return (
    <div className="wfield-card">
      <p className="wsection-label">Release and license checklist</p>
      <p className="wfield-hint-block">
        Code rights are independent of the support and update period.
        Publication requires this checklist and the legal review in Settings →
        Legal.
      </p>
      {(
        [
          ["codeLicense", "Code license (SPDX or “Commercial”)", "MIT, GPL-3.0-or-later, Commercial"],
          ["noticesUrl", "License and third-party notices URL", "/docs"],
          ["releaseVersion", "Release version", "1.0.0"],
          ["testedVersions", "Actually tested platform and runtime versions", ""],
        ] as const
      ).map(([key, label, placeholder]) => (
        <TextField
          key={key}
          label={label}
          placeholder={placeholder}
          value={value[key]}
          onChange={(v) => set(key, v)}
          maxLength={2000}
        />
      ))}
      <TextArea
        label="Support installation scope and included services"
        value={value.serviceScope}
        onChange={(v) => set("serviceScope", v)}
        maxLength={2000}
      />
      <p className="wfield-hint-block">
        Installation counts describe support coverage, not limits on the code
        licence.
      </p>
      <Switch
        label="I verified the package, compatibility, rights and service scope"
        checked={value.reviewed}
        onChange={(v) => set("reviewed", v)}
      />
      {publicationMissingLabels(value).length > 0 && (
        <p className="wfield-hint-block">
          Still needed: {publicationMissingLabels(value).join(", ")}
        </p>
      )}
    </div>
  );
}
