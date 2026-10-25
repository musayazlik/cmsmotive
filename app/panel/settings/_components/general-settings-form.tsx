"use client";

import TextField from "@/app/panel/_components/ui/text-field";
import Switch from "@/app/panel/_components/ui/switch";
import Select from "@/app/panel/_components/ui/select";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { SITE_LIMITS, type SiteSettings } from "@/lib/site-settings-shared";
import { saveSiteSettingsAction } from "../_actions";
import { SettingsFoot, useSettingsForm } from "./settings-kit";

export default function GeneralSettingsForm({ settings }: { settings: SiteSettings }) {
  const form = useSettingsForm(settings, saveSiteSettingsAction);
  const { values, set } = form;
  const profiles = values.socialProfiles;

  function setProfile(index: number, value: string) {
    set("socialProfiles", profiles.map((profile, at) => (at === index ? value : profile)));
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Identity</p>
        <TextField
          label="Site name"
          value={values.siteName}
          onChange={(value) => set("siteName", value)}
          maxLength={SITE_LIMITS.siteName}
          note="og:site_name and the Organization / WebSite names in structured data. Page titles and visible copy come from the static site."
        />
        <TextField
          label="X account"
          value={values.twitterHandle}
          onChange={(value) => set("twitterHandle", value)}
          placeholder="@cmsmotive"
          note="The twitter:site of every link preview. Leave empty to omit it."
        />
        <TextField
          label="Public contact e-mail"
          type="email"
          value={values.contactEmail}
          onChange={(value) => set("contactEmail", value)}
          note="Listed on the Organization in structured data. Contact form mail goes to the inbox under Email."
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">System</p>
        <Select
          label="System language"
          value={values.systemLanguage}
          onChange={(value) => set("systemLanguage", value as Locale)}
          options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
          note="The panel assistant (the chat in the bottom-right corner) greets you, suggests questions and answers in this language."
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Accounts</p>
        <Switch
          checked={values.allowSignup}
          onChange={(checked) => set("allowSignup", checked)}
          label="New accounts can sign up"
          note="Off: the register page redirects to sign-in, the sign-in page hides the create-account link, and the auth API rejects sign-ups. Existing accounts keep signing in; accounts created from the panel still work."
        />
      </div>

      <div className="wsettings-section">
        <div className="wsettings-heading">
          <p className="wsection-label">Social profiles</p>
          <span className="wsettings-count">
            {profiles.length} / {SITE_LIMITS.profiles}
          </span>
        </div>
        <p className="wfield-hint-block" style={{ marginTop: 0 }}>
          Published as the organization&apos;s <code>sameAs</code>, which helps search engines connect these accounts to
          the site. The top bar links are part of the static pages.
        </p>
        {profiles.map((profile, index) => (
          <div className="wsettings-copy-row" key={index}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextField
                label={`Profile ${index + 1}`}
                hideLabel
                type="url"
                value={profile}
                placeholder="https://"
                onChange={(value) => setProfile(index, value)}
              />
            </div>
            <button
              type="button"
              className="wbtn wbtn-ghost wcopy-btn"
              onClick={() => set("socialProfiles", profiles.filter((_, at) => at !== index))}
              aria-label={`Remove profile ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="wbtn wbtn-ghost"
            onClick={() => set("socialProfiles", [...profiles, ""])}
            disabled={profiles.length >= SITE_LIMITS.profiles}
          >
            Add profile
          </button>
        </div>
      </div>

      <SettingsFoot form={form} />
    </div>
  );
}
