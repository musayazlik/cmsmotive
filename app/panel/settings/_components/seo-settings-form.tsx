"use client";

import { useState } from "react";
import MediaPicker from "@/app/panel/_components/media-picker";
import Select from "@/app/panel/_components/ui/select";
import Switch from "@/app/panel/_components/ui/switch";
import TextArea from "@/app/panel/_components/ui/text-area";
import TextField from "@/app/panel/_components/ui/text-field";
import {
  BUILT_IN_DISALLOW,
  BUILT_IN_HOME_DESCRIPTION,
  BUILT_IN_HOME_TITLE,
  DEFAULT_TITLE_SUFFIX,
  generatedRobotsTxt,
  SEO_LIMITS,
  verificationCode,
  type CustomMeta,
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
  const customRobots = values.robotsCustom.trim() !== "";
  const metas = values.customMetas;

  /** The search preview mirrors what addLegacySeo writes: base + suffix, description as saved. */
  const homePreviewTitle = `${(values.homeTitle || BUILT_IN_HOME_TITLE).replace(/\s*[—–|-]\s*CMSMotive\s*$/, "")}${values.titleSuffix}`;
  const homePreviewText = values.homeDescription || BUILT_IN_HOME_DESCRIPTION;

  /** What /robots.txt answers right now: the settings decide between index, disallow and custom content. */
  const robotsText = !values.indexing
    ? generatedRobotsTxt(origin, values)
    : values.robotsCustom.trim() || generatedRobotsTxt(origin, values);

  function setDisallow(text: string) {
    setDisallowText(text);
    set(
      "robotsDisallow",
      text.split("\n").map((line) => line.trim()).filter(Boolean),
    );
  }

  function setMeta(index: number, patch: Partial<CustomMeta>) {
    set("customMetas", metas.map((meta, at) => (at === index ? { ...meta, ...patch } : meta)));
  }

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
          <Switch
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
          <pre className="wsettings-pre" aria-label="Current robots.txt">
            {robotsText}
          </pre>
          {values.indexing ? (
            <Switch
              checked={customRobots}
              onChange={(checked) =>
                set(
                  "robotsCustom",
                  checked ? generatedRobotsTxt(origin, { indexing: true, robotsDisallow: values.robotsDisallow }) : "",
                )
              }
              label="Write the robots.txt by hand"
              note="Switch on and edit the served file line by line — comments, per-bot rules, Crawl-delay, the Sitemap list. Switch it off to generate the file from the extra disallowed paths again."
            />
          ) : null}
          {values.indexing && customRobots ? (
            <TextArea
              label="robots.txt content"
              value={values.robotsCustom}
              onChange={(text) => set("robotsCustom", text)}
              rows={10}
              maxLength={SEO_LIMITS.robots}
              note={`Served exactly as written, from /robots.txt. Saved indexing rules no longer apply while this is on. At most ${SEO_LIMITS.robots} characters.`}
            />
          ) : null}
          {values.indexing && !customRobots ? (
            <TextArea
              label="Extra disallowed paths"
              value={disallowText}
              onChange={setDisallow}
              rows={4}
              placeholder={"/drafts/\n/tmp-landing"}
              note={`One path per line, at most ${SEO_LIMITS.disallowPaths}. Always disallowed: ${BUILT_IN_DISALLOW.join(", ")}.`}
            />
          ) : null}
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
            label="Home page title"
            value={values.homeTitle}
            onChange={(value) => set("homeTitle", value)}
            maxLength={SEO_LIMITS.homeTitle}
            placeholder={BUILT_IN_HOME_TITLE}
            note={`The search title of the home page instead of its built-in copy; the title suffix is appended as on every page. Leave empty to keep the built-in title. Google shows about 60 characters.`}
          />
          <TextArea
            label="Home page description"
            value={values.homeDescription}
            onChange={(text) => set("homeDescription", text)}
            rows={3}
            maxLength={SEO_LIMITS.homeDescription}
            placeholder={BUILT_IN_HOME_DESCRIPTION}
            note={`The meta description of the home page in every language. Leave empty to keep the built-in copy. Google shows about 155 characters.`}
          />
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
            <span className="wserp-title">{homePreviewTitle}</span>
            <span className="wserp-text">{homePreviewText}</span>
          </div>
        </div>

        <div className="wsettings-section">
          <div className="wsettings-heading">
            <p className="wsection-label">Header meta tags</p>
            <span className="wsettings-count">
              {metas.length} / {SEO_LIMITS.metas}
            </span>
          </div>
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            Your own meta tags in the head of every public page, next to the verification tags: marketing pixels,
            chartbeat-style keys, extra Open Graph properties. Duplicate names are written as typed.
          </p>
          {metas.map((meta, index) => (
            <div className="wmeta-row" key={`${meta.attr}-${index}`}>
              <div className="wmeta-attr">
                <Select
                  label={`Attribute of tag ${index + 1}`}
                  hideLabel
                  value={meta.attr}
                  onChange={(value) => setMeta(index, { attr: value === "property" ? "property" : "name" })}
                  options={[
                    { value: "name", label: "name" },
                    { value: "property", label: "property" },
                  ]}
                />
              </div>
              <div className="wmeta-name">
                <TextField
                  label={`Name of meta tag ${index + 1}`}
                  hideLabel
                  value={meta.name}
                  onChange={(value) => setMeta(index, { name: value })}
                  placeholder={meta.attr === "property" ? "og:video:release" : "theme-color"}
                  maxLength={SEO_LIMITS.metaName}
                />
              </div>
              <div className="wmeta-content">
                <TextField
                  label={`Content of meta tag ${index + 1}`}
                  hideLabel
                  value={meta.content}
                  onChange={(value) => setMeta(index, { content: value })}
                  placeholder="#f7f8f5"
                  maxLength={SEO_LIMITS.metaContent}
                />
              </div>
              <button
                type="button"
                className="wbtn wbtn-ghost"
                onClick={() => set("customMetas", metas.filter((_, at) => at !== index))}
                aria-label={`Remove meta tag ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="wbtn wbtn-ghost"
              onClick={() => set("customMetas", [...metas, { attr: "name", name: "", content: "" }])}
              disabled={metas.length >= SEO_LIMITS.metas}
            >
              Add meta tag
            </button>
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
