"use client";
import LegalPagesTable from "./legal-pages-table";
import type { LegalDocumentSettings } from "@/lib/legal-documents-shared";
import TextField from "@/app/panel/_components/ui/text-field";
import TextArea from "@/app/panel/_components/ui/text-area";
import Switch from "@/app/panel/_components/ui/switch";
import {
  legalReadiness,
  type LegalSettings,
} from "@/lib/legal-settings-shared";
import { saveLegalSettingsAction } from "../_actions";
import { SettingsFoot, useSettingsForm } from "./settings-kit";

export default function LegalSettingsForm({
  settings,
  documents,
}: {
  settings: LegalSettings;
  documents: LegalDocumentSettings;
}) {
  const form = useSettingsForm(settings, saveLegalSettingsAction);
  const { values, set } = form;
  const missing = legalReadiness(values);
  return (
    <div className="wsettings-stack">
      <LegalPagesTable settings={settings} saved={documents} />
      <div className="wtable-card wsettings-card wlegal-business">
      <details className="wlegal-details">
        <summary><span><strong>Readiness & required information</strong><small>What still needs attention before registrations and sales can open.</small></span><span className={missing.length ? "wbadge wbadge-pending" : "wbadge wbadge-verified"}>{missing.length ? `${missing.length} to complete` : "Complete"}</span></summary>
        <div className="wsettings-section">
        <p className="wfield-hint-block">
          Business details populate the default legal pages. These checks also
          control registrations, newsletters and sales. Editing a page does not
          automatically mark it reviewed.
        </p>
        {missing.length ? (
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p role="status">Account and privacy information is complete.</p>
        )}
      </div>
      </details>
      <details className="wlegal-details">
        <summary><span><strong>Business details</strong><small>Who operates the site. Used by the generated legal pages and account checks.</small></span></summary>
        <div className="wsettings-section">
        {(
          [
            ["legalName", "Registered legal name"],
            ["country", "Seller country"],
            ["representative", "Authorized representative (if applicable)"],
            [
              "registerDetails",
              "Register and registration number (if applicable)",
            ],
            ["vatId", "VAT / tax identification (if applicable)"],
            ["contactEmail", "Contact email"],
            ["privacyEmail", "Privacy contact email"],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            value={values[key]}
            onChange={(v) => set(key, v)}
            maxLength={3000}
            type={key === "contactEmail" || key === "privacyEmail" ? "email" : "text"}
          />
        ))}
        <TextArea
          label="Full postal address"
          value={values.address}
          onChange={(v) => set("address", v)}
          rows={3}
        />

        <label className="wfield">
          <span>Customer audience</span>
          <select
            value={values.audience}
            onChange={(e) => set("audience", e.target.value)}
          >
            <option value="undecided">Not decided</option>
            <option value="b2b">Businesses only</option>
            <option value="b2c">Consumers</option>
            <option value="both">Businesses and consumers</option>
          </select>
          <span className="wfield-hint-block">Used in the sales terms review: businesses, consumers or both.</span>
        </label>
      </div>
      </details>
      <details className="wlegal-details">
        <summary><span><strong>Privacy & data handling</strong><small>Describe your actual providers and retention periods for the privacy policy.</small></span></summary>
        <div className="wsettings-section">
        <p className="wfield-hint-block">These facts populate the generated privacy policy. They remain part of the operational checks when you use custom page content.</p>
        {(
          [
            [
              "hostDetails",
              "Actual host, database provider and processing regions",
            ],
            [
              "retentionDetails",
              "Retention periods by purpose, including logs and backups",
            ],
            [
              "transferDetails",
              "Processors, regions and international transfer safeguards",
            ],
            [
              "supervisoryAuthority",
              "Competent supervisory authority and contact",
            ],

          ] as const
        ).map(([key, label]) => (
          <TextArea
            key={key}
            label={label}
            value={values[key]}
            onChange={(v) => set(key, v)}
            rows={3}
          />
        ))}
      </div>
      </details>
      <details className="wlegal-details">
        <summary><span><strong>Review & consent versions</strong><small>Confirm document reviews and track the versions accepted by account holders.</small></span></summary>
        <div className="wsettings-section">
        <TextField
          label="Account terms version"
          value={values.termsVersion}
          onChange={(v) => set("termsVersion", v)}
          maxLength={40}
          note="Saved with user consent. Update after material document changes, for example 2026-10-27."
        />
        <TextField
          label="Privacy version"
          value={values.privacyVersion}
          onChange={(v) => set("privacyVersion", v)}
          maxLength={40}
          note="Saved with user consent. Update after material document changes, for example 2026-10-27."
        />
        <Switch
          checked={values.accountTermsReviewed}
          onChange={(v) => set("accountTermsReviewed", v)}
          label="Account terms reviewed for our actual operation"
        />
        <Switch
          checked={values.privacyReviewed}
          onChange={(v) => set("privacyReviewed", v)}
          label="Privacy information reviewed against our actual providers and retention"
        />

        <Switch
          checked={values.salesTermsReviewed}
          onChange={(v) => set("salesTermsReviewed", v)}
          label="Sales terms reviewed for the selected customer audience"
          note="This does not enable a checkout. Every product must also pass its release checklist."
        />
      </div>
      </details>
      <details className="wlegal-details">
        <summary><span><strong>Product licensing & trademarks</strong><small>Optional publishing rules. Configure only when they apply to your catalogue.</small></span></summary>
        <div className="wsettings-section">

        <TextField
          label="Trademarks product names may not contain"
          hint="comma separated"
          value={values.reservedNameTerms}
          onChange={(v) => set("reservedNameTerms", v)}
          maxLength={3000}
          note="Checked before a product is published, e.g. a platform name products may only claim compatibility with."
        />
        <Switch
          checked={values.gplCodeRequired}
          onChange={(v) => set("gplCodeRequired", v)}
          label="Products in this store are GPL code (TYPO3 extensions and themes)"
          note="Code licences must then be GPL, and every uploaded package is checked for the GPL text, readable (not encoded) source and third-party notices."
        />
          <TextArea label="Trademark or membership permission reference" value={values.membershipDetails} onChange={(v) => set("membershipDetails", v)} rows={3} />
          <p className="wfield-hint-block">Internal reference only; this note is not displayed on legal pages.</p>
        </div>
      </details>
      <SettingsFoot form={form} />
      </div>
    </div>
  );
}
