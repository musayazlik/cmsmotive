"use client";

import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import { REVIEW_SETTING_LIMITS, type ReviewSettings } from "@/lib/review-settings-shared";
import { saveReviewSettingsAction } from "../_actions";
import { EnvFacts, RangeField, SettingsFoot, useSettingsForm } from "./settings-kit";

const RATING_OPTIONS = [1, 2, 3, 4, 5].map((stars) => ({
  value: String(stars),
  label: stars === 5 ? "5 stars only" : `${stars}+ stars`,
}));

export default function ReviewSettingsForm({
  settings,
  recaptchaConfigured,
}: {
  settings: ReviewSettings;
  recaptchaConfigured: boolean;
}) {
  const form = useSettingsForm(settings, saveReviewSettingsAction);
  const { values, set } = form;
  const { perHour, minCaptchaScore } = REVIEW_SETTING_LIMITS;

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Moderation</p>
        <CheckBox
          checked={values.autoApprove}
          onChange={(checked) => set("autoApprove", checked)}
          label="Publish new reviews without moderation"
          note="Reviews go live as soon as they pass reCAPTCHA. You can still reject them later under Reviews. When off, each one waits as pending."
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Spam protection</p>
        <EnvFacts
          facts={[
            {
              label: "reCAPTCHA keys",
              value: recaptchaConfigured ? "Configured" : "Missing — reviews are refused",
              ok: recaptchaConfigured,
            },
          ]}
        />
        <RangeField
          label="Reviews per e-mail address per hour"
          value={values.perHour}
          onChange={(value) => set("perHour", value)}
          min={perHour.min}
          max={perHour.max}
          note="Counted across all products. Further submissions get a “try again later” message."
        />
        <RangeField
          label="Minimum reCAPTCHA score"
          value={values.minCaptchaScore}
          onChange={(value) => set("minCaptchaScore", value)}
          min={minCaptchaScore.min}
          max={minCaptchaScore.max}
          step={0.1}
          format={(value) => value.toFixed(1)}
          note={
            values.minCaptchaScore >= 0.7
              ? "Strict: fewer bots, but some real visitors on VPNs or new browsers may be refused."
              : values.minCaptchaScore >= 0.5
                ? "Google's recommended balance."
                : "Lenient: lets more borderline traffic through. Pair it with moderation."
          }
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Home page showcase</p>
        <CheckBox
          checked={values.showcase}
          onChange={(checked) => set("showcase", checked)}
          label="Quote approved reviews on the home page"
          note="Replaces the early-access “beta seat” cards with the newest approved reviews of at least 40 characters."
        />
        {values.showcase ? (
          <Select
            label="Minimum rating"
            value={String(values.showcaseMinRating)}
            onChange={(value) => set("showcaseMinRating", Number(value))}
            options={RATING_OPTIONS}
          />
        ) : null}
      </div>

      <SettingsFoot form={form} />
    </div>
  );
}
