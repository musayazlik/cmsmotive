"use client";
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
}: {
  settings: LegalSettings;
}) {
  const form = useSettingsForm(settings, saveLegalSettingsAction);
  const { values, set } = form;
  const missing = legalReadiness(values);
  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Publication checklist</p>
        <p className="wfield-hint-block">
          These details appear on the legal pages. Do not enter API keys or
          private credentials. Complete and review them before accepting
          registrations, subscriptions or publishing products for sale.
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
      <div className="wsettings-section">
        <p className="wsection-label">Seller identity</p>
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
          />
        ))}
        <TextArea
          label="Full postal address"
          value={values.address}
          onChange={(v) => set("address", v)}
          rows={3}
        />
        <TextField
          label="Trademarks product names may not contain"
          hint="comma separated"
          value={values.reservedNameTerms}
          onChange={(v) => set("reservedNameTerms", v)}
          maxLength={3000}
          note="Checked before a product is published, e.g. a platform name products may only claim compatibility with."
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
        </label>
      </div>
      <div className="wsettings-section">
        <p className="wsection-label">Data processing</p>
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
            [
              "membershipDetails",
              "Trademark or membership permission reference (internal)",
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
      <div className="wsettings-section">
        <p className="wsection-label">Document versions and review</p>
        <TextField
          label="Account terms version"
          value={values.termsVersion}
          onChange={(v) => set("termsVersion", v)}
          maxLength={40}
        />
        <TextField
          label="Privacy version"
          value={values.privacyVersion}
          onChange={(v) => set("privacyVersion", v)}
          maxLength={40}
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
          checked={values.gplCodeRequired}
          onChange={(v) => set("gplCodeRequired", v)}
          label="Products in this store are GPL code (TYPO3 extensions and themes)"
          note="Code licences must then be GPL, and every uploaded package is checked for the GPL text, readable (not encoded) source and third-party notices."
        />
        <Switch
          checked={values.salesTermsReviewed}
          onChange={(v) => set("salesTermsReviewed", v)}
          label="Sales terms reviewed for the selected customer audience"
          note="This does not enable a checkout. Every product must also pass its release checklist."
        />
        <p>
          <a href="/imprint" target="_blank" rel="noreferrer">
            Imprint
          </a>{" "}
          ·{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy
          </a>{" "}
          ·{" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms
          </a>{" "}
          ·{" "}
          <a href="/cookies" target="_blank" rel="noreferrer">
            Cookies
          </a>
        </p>
      </div>
      <SettingsFoot form={form} />
    </div>
  );
}
