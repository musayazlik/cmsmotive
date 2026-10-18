"use client";

import { useState } from "react";
import MediaPicker from "@/app/panel/_components/media-picker";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import TextArea from "@/app/panel/_components/ui/text-area";
import TextField from "@/app/panel/_components/ui/text-field";
import {
  BUILT_IN_DISALLOW,
  DEFAULT_TITLE_SUFFIX,
  SEO_LIMITS,
  verificationCode,
  type SeoSettings,
} from "@/lib/seo-settings-shared";
import { saveSeoSettingsAction } from "../_actions";
import { SettingsFoot, useSettingsForm } from "./settings-kit";

type Props = {
  settings: SeoSettings;
  /** Public origin, for the robots.txt / sitemap links and the preview. */
  origin: string;
  /** Bundled image used while no share image is chosen. */
  defaultShareImage: string;
};

const CONSOLES = [
  {
    key: "googleVerification",
    label: "Google Search Console",
    href: "https://search.google.com/search-console",
    tag: "google-site-verification",
  },
  { key: "bingVerification", label: "Bing Webmaster Tools", href: "https://www.bing.com/webmasters", tag: "msvalidate.01" },
  { key: "yandexVerification", label: "Yandex Webmaster", href: "https://webmaster.yandex.com", tag: "yandex-verification" },
] as const;

export default function SeoSettingsForm({ settings, origin, defaultShareImage }: Props) {
  const form = useSettingsForm(settings, saveSeoSettingsAction);
  const { values, set } = form;
  const [picking, setPicking] = useState(false);
  // The textarea keeps what is typed (blank lines included); the list is derived on change.
  const [disallowText, setDisallowText] = useState(settings.robotsDisallow.join("\n"));

  const shareImage = values.shareImageUrl || defaultShareImage;
  const preview = `TYPO3 themes${values.titleSuffix}`;

  return (
    <div className="wsettings-stack">
      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <div className="wsettings-heading">
            <p className="wsection-label">Indexing</p>
            <span className={`wbadge ${values.indexing ? "wbadge-verified" : "wbadge-missing"}`}>
              {values.indexing ? "Indexable" : "Hidden from search"}
            </span>
          </div>
          <CheckBox
            checked={values.indexing}
            onChange={(checked) => set("indexing", checked)}
            label="Let search engines index the site"
            note="Turn off on staging or before launch: robots.txt then disallows everything and every public page is marked noindex. Pages already indexed drop out over the following weeks."
          />
          {!values.indexing ? (
            <p className="wdialog-error" role="alert" style={{ margin: 0 }}>
              The whole public site will be hidden from Google and other search engines once saved.
            </p>
          ) : null}
          <TextArea
            label="Extra disallowed paths"
            value={disallowText}
            onChange={(text) => {
              setDisallowText(text);
              set(
                "robotsDisallow",
                text.split("\n").map((line) => line.trim()).filter(Boolean),
              );
            }}
            rows={4}
            placeholder={"/drafts/\n/tmp-landing"}
            note={`One path per line, at most ${SEO_LIMITS.disallowPaths}. Always disallowed: ${BUILT_IN_DISALLOW.join(", ")}.`}
          />
          <div className="wsettings-actions">
            <a className="wbtn wbtn-ghost" href={`${origin}/robots.txt`} target="_blank" rel="noreferrer">
              View robots.txt ↗
            </a>
            <a className="wbtn wbtn-ghost" href={`${origin}/sitemap.xml`} target="_blank" rel="noreferrer">
              View sitemap.xml ↗
            </a>
          </div>
        </div>

        <div className="wsettings-section">
          <p className="wsection-label">Titles</p>
          <TextField
            label="Title suffix"
            value={values.titleSuffix}
            onChange={(value) => set("titleSuffix", value)}
            maxLength={SEO_LIMITS.titleSuffix}
            placeholder={DEFAULT_TITLE_SUFFIX}
            note="Appended to every page title, including the static pages and their translations. Include the leading space and separator; leave empty for bare titles."
          />
          <div className="wserp" aria-label="Search result preview">
            <span className="wserp-url">{origin.replace(/^https?:\/\//, "")} › themes</span>
            <span className="wserp-title">{preview}</span>
            <span className="wserp-text">Production-ready TYPO3 themes with accessible components and documented content elements…</span>
          </div>
        </div>

        <div className="wsettings-section">
          <p className="wsection-label">Default share image</p>
          <div className="wshare">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shareImage} alt="" />
            <div>
              <p className="wfield-hint-block" style={{ marginTop: 0 }}>
                Shown in link previews (Open Graph, X, LinkedIn, WhatsApp) of pages that have no image of their own.
                Use 1200 × 630 px.
              </p>
              <div className="wsettings-actions">
                <button type="button" className="wbtn wbtn-ghost" onClick={() => setPicking(true)}>
                  {values.shareImageUrl ? "Change image" : "Choose image"}
                </button>
                {values.shareImageUrl ? (
                  <button
                    type="button"
                    className="wbtn wbtn-ghost"
                    onClick={() => {
                      set("shareImageUrl", "");
                      set("shareImageId", "");
                    }}
                  >
                    Use the built-in image
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="wsettings-section">
          <p className="wsection-label">Search console verification</p>
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            Proves to each console that you own the site. Paste the code, or the whole &lt;meta&gt; tag the console shows
            under “HTML tag” verification.
          </p>
          {CONSOLES.map((console) => (
            <TextField
              key={console.key}
              label={console.label}
              value={values[console.key]}
              onChange={(value) => set(console.key, value)}
              placeholder={`<meta name="${console.tag}" content="…">`}
              hint={values[console.key] && verificationCode(values[console.key]) !== values[console.key] ? "code extracted on save" : undefined}
            />
          ))}
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            Open{" "}
            {CONSOLES.map((console, index) => (
              <span key={console.key}>
                {index > 0 ? " · " : ""}
                <a href={console.href} target="_blank" rel="noreferrer">
                  {console.label} ↗
                </a>
              </span>
            ))}
          </p>
        </div>

        <SettingsFoot form={form} />
      </div>

      <MediaPicker
        open={picking}
        title="Choose the default share image"
        kinds={["image"]}
        endpoint="blogMedia"
        confirmLabel="Use as share image"
        onClose={() => setPicking(false)}
        onSelect={(items) => {
          const [item] = items;
          if (item) {
            set("shareImageUrl", item.url);
            set("shareImageId", item.assetId);
          }
          setPicking(false);
        }}
      />
    </div>
  );
}
