import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, localizePath, type Locale } from "./i18n/config";
import { DEFAULT_TITLE_SUFFIX, type SeoSettings } from "./seo-settings-shared";
import { getSeoSettings, getSiteSettings } from "./settings";
import type { SiteSettings } from "./site-settings-shared";
import { currentStore, currentStoreId } from "./current-store";

/**
 * Search and link-preview metadata for the public site.
 *
 * - React pages (journal, theme and extension details) build their Metadata
 *   with pageMetadata(); the root layout sets `metadataBase` from siteOrigin().
 * - Static-site pages get the same tags from addLegacySeo(), applied by the
 *   legacy route after translation: canonical, hreflang, og:url, og:locale,
 *   absolute share images and JSON-LD read from the page itself, so the
 *   structured data always matches the copy in the page's language.
 * - app/sitemap.ts and app/robots.ts use siteOrigin() for absolute URLs.
 * - The site name, X handle, contact address and social profiles come from
 *   Settings → General (getSiteSettings()).
 */

type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/** 1200x630 JPEG copies of the page images (public/assets/images/og/), which every scraper can show. */
const SHARE_COPIES = new Set(["nordform-architecture", "hero-typo3-template-v1", "hero-nordform-v2", "foundation-studio", "campus-library"]);
export const DEFAULT_SHARE_IMAGE: ShareImage = { url: "/assets/images/og/nordform-architecture.jpg", width: 1200, height: 630 };

/**
 * Canonical origin of the store this request belongs to (lib/stores.ts) for
 * canonical URLs, hreflang, Open Graph, JSON-LD, the sitemap and robots.txt.
 */
export async function siteOrigin(): Promise<string> {
  return (await currentStore()).origin;
}

/** Resolves a root-relative or page-relative URL (`/assets/x.jpg`, `assets/x.jpg`) against the origin. */
export function absoluteUrl(origin: string, url: string) {
  return new URL(url, `${origin}/`).toString();
}

/** `og:locale` value for a site language (`tr` -> `tr_TR`). */
function ogLocale(locale: Locale) {
  return LOCALE_TAGS[locale].replace("-", "_");
}

/**
 * hreflang targets for an unprefixed site path. `defaultLocale` is the store's
 * unprefixed language (the proxy 301s its prefixed form), so x-default and
 * that locale's entry must both resolve to the unprefixed URL.
 */
export function languageAlternates(path: string, defaultLocale: Locale = DEFAULT_LOCALE): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((code) => [code, localizePath(path, code, defaultLocale)])),
    "x-default": localizePath(path, defaultLocale),
  };
}

/** Prefers the JPEG share copy of a bundled page image; other images are used as they are. */
/**
 * Titles are written with the default " — CMSMotive" suffix (React pages,
 * translations and the static pages alike); Settings → SEO swaps it for its
 * own suffix, or drops it.
 */
export function withTitleSuffix(title: string, suffix: string): string {
  const base = title.replace(/\s*[—–|-]\s*CMSMotive\s*$/, "");
  return base === title && suffix === DEFAULT_TITLE_SUFFIX ? title : `${base}${suffix}`;
}

/**
 * The home page title from Settings → SEO: the built-in copy is replaced by
 * the configured base before the suffix is (re)applied. Unlike
 * withTitleSuffix this never skips, so switching to the default suffix while
 * a custom home title is set still appends " — CMSMotive".
 */
function homeTitleWithSuffix(base: string, suffix: string): string {
  return `${base.replace(/\s*[—–|-]\s*CMSMotive\s*$/, "")}${suffix}`;
}

export function shareImage(image: ShareImage | null | undefined, fallbackUrl?: string): ShareImage {
  if (!image) return fallbackUrl ? { url: fallbackUrl } : DEFAULT_SHARE_IMAGE;
  const bundled = image.url.match(/^\/assets\/images\/([\w-]+)\.webp$/);
  if (bundled && SHARE_COPIES.has(bundled[1])) return { url: `/assets/images/og/${bundled[1]}.jpg`, width: 1200, height: 630, alt: image.alt };
  return image;
}

type PageMetadataInput = {
  locale: Locale;
  /** Unprefixed site path (`/blog/my-post`); the canonical URL is its localized form. */
  path: string;
  title: string;
  description: string;
  /**
   * The store's unprefixed default language. Defaults to the site default
   * ("de"); the page builder passes its store's own choice so the canonical
   * URL never points at a 301 (plan 5.8/5.9).
   */
  defaultLocale?: Locale;
  image?: ShareImage | null;
  type?: "website" | "article";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  authors?: string[];
};

/** Indexable page metadata: canonical, hreflang, Open Graph and Twitter card. Relative URLs resolve against `metadataBase`. */
export async function pageMetadata({ locale, path, title: rawTitle, description, defaultLocale = DEFAULT_LOCALE, image, type = "website", publishedTime, modifiedTime, authors }: PageMetadataInput): Promise<Metadata> {
  const storeId = await currentStoreId();
  const [site, seo] = await Promise.all([getSiteSettings(storeId), getSeoSettings(storeId)]);
  const url = localizePath(path, locale, defaultLocale);
  const share = shareImage(image, seo.shareImageUrl);
  const title = withTitleSuffix(rawTitle, seo.titleSuffix);
  const verification = {
    ...(seo.googleVerification ? { google: seo.googleVerification } : {}),
    ...(seo.yandexVerification ? { yandex: seo.yandexVerification } : {}),
    ...(seo.bingVerification ? { other: { "msvalidate.01": seo.bingVerification } } : {}),
  };
  return {
    title,
    description,
    robots: { index: seo.indexing, follow: seo.indexing },
    ...(Object.keys(verification).length ? { verification } : {}),
    alternates: { canonical: url, languages: languageAlternates(path, defaultLocale) },
    openGraph: {
      type,
      url,
      siteName: site.siteName,
      title,
      description,
      locale: ogLocale(locale),
      alternateLocale: LOCALES.filter((code) => code !== locale).map(ogLocale),
      images: [share],
      ...(type === "article"
        ? { publishedTime: publishedTime?.toISOString(), modifiedTime: modifiedTime?.toISOString(), authors }
        : {}),
    },
    twitter: { card: "summary_large_image", ...(site.twitterHandle ? { site: site.twitterHandle } : {}), title, description, images: [share.url] },
  };
}

/* ------------------------------------------------------------------ JSON-LD */

type JsonLd = Record<string, unknown>;

/** Serialized for a `<script type="application/ld+json">`; `<` is escaped so copy can never close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]) {
  const payload = Array.isArray(data) ? { "@context": "https://schema.org", "@graph": data } : { "@context": "https://schema.org", ...data };
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

export function organizationSchema(origin: string, site: SiteSettings, description?: string): JsonLd {
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: site.siteName,
    url: `${origin}/`,
    logo: { "@type": "ImageObject", url: `${origin}/assets/images/logo.png`, width: 2172, height: 724 },
    ...(site.contactEmail ? { email: site.contactEmail } : {}),
    ...(site.socialProfiles.length ? { sameAs: site.socialProfiles } : {}),
    ...(description ? { description } : {}),
  };
}

/** The publisher/brand reference used inside other entities. */
export function organizationRef(origin: string, site: SiteSettings): JsonLd {
  return { "@type": "Organization", "@id": `${origin}/#organization`, name: site.siteName, url: `${origin}/` };
}

/** Breadcrumb trail; every step but the last needs a URL (steps without one are left out). */
export function breadcrumbSchema(origin: string, steps: { name: string; url?: string }[]): JsonLd | null {
  const items = steps.filter((step, index) => step.name && (step.url || index === steps.length - 1));
  if (items.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      ...(step.url ? { item: absoluteUrl(origin, step.url) } : {}),
    })),
  };
}

/* ------------------------------------------------- static-site pages (HTML) */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "" };

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Visible text of an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
function htmlText(fragment: string) {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
      if (name[0] === "#") return String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string) {
  const tag = html.match(new RegExp(`<meta\\b[^>]*\\b(?:name|property)=["']${key}["'][^>]*>`, "i"))?.[0];
  const value = tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1];
  return value === undefined ? undefined : htmlText(value);
}

/** Questions and answers of the `faq-item` accordions (build.py faq()). */
function faqSchema(html: string): JsonLd | null {
  const entries = Array.from(html.matchAll(/<details\b[^>]*\bclass=["'][^"']*\bfaq-item\b[^>]*>([\s\S]*?)<\/details\s*>/gi), ([, item]) => ({
    question: htmlText(item.match(/class=["']faq-question["'][^>]*>([\s\S]*?)<\/span\s*>/i)?.[1] ?? ""),
    answer: htmlText(item.match(/class=["']faq-answer["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1] ?? ""),
  })).filter((entry) => entry.question && entry.answer);
  if (entries.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/**
 * The `.crumbs` trail at the top of a page; its last step is the page itself.
 * Article trails end in the category, so the article title is added after it
 * (unlinked steps in between are dropped by breadcrumbSchema()). Closing tags
 * may be split across lines (`</span\n>`), as Prettier writes them.
 */
function crumbsSchema(html: string, origin: string, url: string): JsonLd | null {
  const crumbs = html.match(/<div\b[^>]*\bclass=["']crumbs["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1];
  if (!crumbs) return null;
  const steps: { name: string; url?: string }[] = Array.from(
    crumbs.matchAll(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a\s*>|<span\b[^>]*>([\s\S]*?)<\/span\s*>/gi),
    ([, href, linkText, spanText]) => (href !== undefined ? { name: htmlText(linkText), url: href } : { name: htmlText(spanText) }),
  ).filter((step) => step.name && step.name !== "/");
  if (metaContent(html, "og:type") === "article") {
    const title = htmlText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1] ?? "");
    if (title) steps.push({ name: title });
  }
  if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], url };
  return breadcrumbSchema(origin, steps);
}

/** The theme or extension cards of a catalogue page (placeholders have no detail page and are skipped). */
function productListSchema(html: string, origin: string): JsonLd | null {
  const items = Array.from(html.matchAll(/<article\b[^>]*\bclass=["'](?:product-card|article-card)["'][^>]*>([\s\S]*?)<\/article\s*>/gi), ([, card]) => ({
    url: card.match(/\bhref=["']([^"']*\/(?:theme|extension)\/[^"']+)["']/i)?.[1],
    name: htmlText(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3\s*>/i)?.[1] ?? ""),
  })).filter((item): item is { url: string; name: string } => Boolean(item.url && item.name));
  if (items.length === 0) return null;
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, url: absoluteUrl(origin, item.url), name: item.name })),
  };
}

type LegacyPage = {
  origin: string;
  locale: Locale;
  /** Unprefixed public path (`/`, `/themes`). */
  pagePath: string;
  site: SiteSettings;
  seo: SeoSettings;
};

/** JSON-LD for a static-site page, read from its (translated) markup. */
function legacyStructuredData(html: string, { origin, locale, pagePath, site }: LegacyPage, url: string): JsonLd[] {
  const data: JsonLd[] = [];
  if (pagePath === "/") {
    data.push(organizationSchema(origin, site, metaContent(html, "description")), {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: site.siteName,
      url: absoluteUrl(origin, localizePath("/", locale)),
      inLanguage: LOCALE_TAGS[locale],
      publisher: { "@id": `${origin}/#organization` },
    });
  }
  const crumbs = crumbsSchema(html, origin, url);
  if (crumbs) data.push(crumbs);
  const faq = faqSchema(html);
  if (faq) data.push(faq);
  if (pagePath === "/themes" || pagePath === "/extensions") {
    const list = productListSchema(html, origin);
    if (list) data.push(list);
  }
  return data;
}

/**
 * Completes a translated static-site page for search engines and link
 * previews: canonical and hreflang links, og:url and og:locale, absolute
 * og:image / twitter:image URLs and JSON-LD.
 */
export function addLegacySeo(html: string, page: LegacyPage): string {
  const { origin, locale, pagePath } = page;
  const url = absoluteUrl(origin, localizePath(pagePath, locale));
  // Settings → SEO home page fields only apply to the home page ("/" in every language).
  const home = pagePath === "/";
  const homeCopy = {
    titleBase: home && page.seo.homeTitle ? page.seo.homeTitle : null,
    description: home && page.seo.homeDescription ? page.seo.homeDescription : null,
  };
  const out = html
    .replace(
      /(<meta\b[^>]*\b(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*\bcontent=["'])([^"']+)/gi,
      (_match, start: string, value: string) => `${start}${absoluteUrl(origin, value)}`,
    )
    // The pages carry the build-time identity; Settings → General overrides it.
    .replace(
      /(<meta\b[^>]*\bproperty=["']og:site_name["'][^>]*\bcontent=["'])[^"']*/i,
      (_match, start: string) => `${start}${escapeAttribute(page.site.siteName)}`,
    )
    .replace(/<meta\b[^>]*\bname=["']twitter:site["'][^>]*>/i, (tag) =>
      page.site.twitterHandle
        ? tag.replace(/\bcontent=["'][^"']*["']/i, `content="${escapeAttribute(page.site.twitterHandle)}"`)
        : "",
    )
    // Settings → SEO: home page title and description, title suffix, and
    // noindex replaces any robots tag the page ships.
    .replace(/<title>([^<]*)<\/title>/i, (_match, title: string) => {
      const base = homeCopy.titleBase ?? htmlText(title);
      return `<title>${escapeAttribute(homeTitleWithSuffix(base, page.seo.titleSuffix))}</title>`;
    })
    .replace(
      /(<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'])([^"']*)/i,
      (_match, start: string, value: string) =>
        `${start}${escapeAttribute(homeCopy.titleBase ? homeTitleWithSuffix(homeCopy.titleBase, page.seo.titleSuffix) : withTitleSuffix(htmlText(value), page.seo.titleSuffix))}`,
    )
    .replace(
      /(<meta\b[^>]*\bname=["']twitter:title["'][^>]*\bcontent=["'])([^"']*)/i,
      (_match, start: string, value: string) =>
        `${start}${escapeAttribute(homeCopy.titleBase ? homeTitleWithSuffix(homeCopy.titleBase, page.seo.titleSuffix) : withTitleSuffix(htmlText(value), page.seo.titleSuffix))}`,
    )
    .replace(
      /(<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'])([^"']*)/i,
      (_match, start: string, value: string) =>
        `${start}${escapeAttribute(homeCopy.description ?? htmlText(value))}`,
    )
    .replace(
      /(<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["'])([^"']*)/i,
      (_match, start: string, value: string) => `${start}${escapeAttribute(homeCopy.description ?? htmlText(value))}`,
    )
    .replace(
      /(<meta\b[^>]*\bname=["']twitter:description["'][^>]*\bcontent=["'])([^"']*)/i,
      (_match, start: string, value: string) => `${start}${escapeAttribute(homeCopy.description ?? htmlText(value))}`,
    )
    .replace(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi, (tag) => (page.seo.indexing ? tag : ""));
  const { seo } = page;
  const structured = legacyStructuredData(out, page, url);
  const head = [
    seo.indexing ? "" : `<meta name="robots" content="noindex, nofollow">`,
    seo.googleVerification ? `<meta name="google-site-verification" content="${escapeAttribute(seo.googleVerification)}">` : "",
    seo.bingVerification ? `<meta name="msvalidate.01" content="${escapeAttribute(seo.bingVerification)}">` : "",
    seo.yandexVerification ? `<meta name="yandex-verification" content="${escapeAttribute(seo.yandexVerification)}">` : "",
    // Settings → SEO header tags, exactly as saved (name= or property=).
    ...seo.customMetas.map((meta) =>
      meta.attr === "property"
        ? `<meta property="${escapeAttribute(meta.name)}" content="${escapeAttribute(meta.content)}">`
        : `<meta name="${escapeAttribute(meta.name)}" content="${escapeAttribute(meta.content)}">`,
    ),
    `<link rel="canonical" href="${url}">`,
    ...LOCALES.map((code) => `<link rel="alternate" hreflang="${code}" href="${absoluteUrl(origin, localizePath(pagePath, code))}">`),
    `<link rel="alternate" hreflang="x-default" href="${absoluteUrl(origin, pagePath)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${ogLocale(locale)}">`,
    ...LOCALES.filter((code) => code !== locale).map((code) => `<meta property="og:locale:alternate" content="${ogLocale(code)}">`),
    structured.length ? `<script type="application/ld+json">${serializeJsonLd(structured)}</script>` : "",
  ].join("");
  return out.replace(/<\/head>/i, `${head}</head>`);
}
