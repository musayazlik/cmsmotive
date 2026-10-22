/**
 * Client-safe contract for Settings → SEO: whether search engines may index
 * the site, the title suffix, the fallback share image and the ownership
 * verification codes of the search consoles.
 */

export type CustomMeta = {
  /** Tag name as written in the header, e.g. "al:x" (name=) or "og:modify" (property=). */
  name: string;
  content: string;
  /** Which attribute carries the name: `name` (most tags) or `property` (Open Graph). */
  attr: "name" | "property";
};

export type SeoSettings = {
  /** Off = robots.txt disallows everything and every public page is noindex (staging). */
  indexing: boolean;
  /** Appended to page titles, e.g. " — CMSMotive"; "" for bare titles. */
  titleSuffix: string;
  /** The home page's own search title; "" = the built-in copy of the page. */
  homeTitle: string;
  /** The home page's meta description; "" = the built-in copy of the page. */
  homeDescription: string;
  /** Open Graph / X image for pages without their own; "" = the bundled default. */
  shareImageUrl: string;
  shareImageId: string;
  /** Extra robots.txt Disallow paths next to the built-in ones. */
  robotsDisallow: string[];
  /** Verbatim replacement of the generated robots.txt; "" = generate from the settings. */
  robotsCustom: string;
  /** Meta tags written into the header of every public page, after the verification tags. */
  customMetas: CustomMeta[];
  googleVerification: string;
  bingVerification: string;
  yandexVerification: string;
};

/** The suffix the static pages and translations are written with. */
export const DEFAULT_TITLE_SUFFIX = " — CMSMotive";

/** The home page title and description as written in the built page (static-site/index.html). */
export const BUILT_IN_HOME_TITLE = "TYPO3 themes built for real projects";
export const BUILT_IN_HOME_DESCRIPTION =
  "CMSMotive creates considered TYPO3 themes, extensions and headless solutions for professional teams.";

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  indexing: true,
  titleSuffix: DEFAULT_TITLE_SUFFIX,
  homeTitle: "",
  homeDescription: "",
  shareImageUrl: "",
  shareImageId: "",
  robotsDisallow: [],
  robotsCustom: "",
  customMetas: [],
  googleVerification: "",
  bingVerification: "",
  yandexVerification: "",
};

/** Always disallowed, whatever the settings say (app/robots.txt). */
export const BUILT_IN_DISALLOW = ["/panel", "/auth/", "/api/", "/legacy/"];

/**
 * The generated robots.txt when no custom content is set: open to crawlers,
 * closed to the account area, auth flows, APIs and the internal page handler,
 * plus the extra paths from Settings → SEO. With indexing switched off
 * (staging) everything is disallowed.
 */
export function generatedRobotsTxt(origin: string, seo: { indexing: boolean; robotsDisallow: string[] }): string {
  if (!seo.indexing) return "User-Agent: *\nDisallow: /";
  return [
    "User-Agent: *",
    "Allow: /",
    ...[...BUILT_IN_DISALLOW, ...seo.robotsDisallow].map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
  ].join("\n");
}

export const SEO_LIMITS = { titleSuffix: 40, homeTitle: 70, homeDescription: 260, disallowPaths: 30, verification: 100, robots: 4_000, metas: 20, metaName: 80, metaContent: 500 } as const;

/** The meta name may only use attribute-safe characters; the content is free text without markup. */
const META_NAME = /^[A-Za-z0-9_][A-Za-z0-9_:./@-]{0,79}$/;

/** Accepts the bare code or the whole `<meta … content="…">` tag the consoles hand out. */
export function verificationCode(value: string): string {
  const trimmed = value.trim();
  return /content=["']([^"']+)["']/i.exec(trimmed)?.[1]?.trim() ?? trimmed;
}

export function validateSeoSettings(input: Record<string, unknown>): { error: string } | { data: SeoSettings } {
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  if (typeof input.indexing !== "boolean") return { error: "Invalid SEO settings." };

  // Leading spaces are meaningful ("Title — Brand"), so only line breaks are removed.
  const titleSuffix = text("titleSuffix").replace(/[\r\n]+/g, " ");
  if (titleSuffix.length > SEO_LIMITS.titleSuffix) {
    return { error: `The title suffix can be at most ${SEO_LIMITS.titleSuffix} characters.` };
  }

  const homeTitle = text("homeTitle").replace(/[\r\n]+/g, " ");
  if (homeTitle.length > SEO_LIMITS.homeTitle) {
    return { error: `The home page title can be at most ${SEO_LIMITS.homeTitle} characters.` };
  }

  const homeDescription = text("homeDescription").replace(/[\r\n\t]+/g, " ");
  if (homeDescription.length > SEO_LIMITS.homeDescription) {
    return { error: `The home page description can be at most ${SEO_LIMITS.homeDescription} characters.` };
  }

  const shareImageUrl = text("shareImageUrl").trim();
  if (shareImageUrl && !/^(https:\/\/|\/)/.test(shareImageUrl)) return { error: "The share image must be an https URL." };

  const paths = Array.isArray(input.robotsDisallow) ? input.robotsDisallow : [];
  const robotsDisallow = [
    ...new Set(paths.map((path) => (typeof path === "string" ? path.trim() : "")).filter(Boolean)),
  ];
  if (robotsDisallow.length > SEO_LIMITS.disallowPaths) {
    return { error: `Add at most ${SEO_LIMITS.disallowPaths} disallowed paths.` };
  }
  const badPath = robotsDisallow.find((path) => !/^\/[\w\-./*?=&%$]*$/.test(path));
  if (badPath) return { error: `"${badPath.slice(0, 40)}" is not a path. Paths start with / (e.g. /drafts/).` };

  const robotsCustom = typeof input.robotsCustom === "string" ? input.robotsCustom.replace(/\r\n?/g, "\n") : "";
  if (robotsCustom.length > SEO_LIMITS.robots) {
    return { error: `A custom robots.txt can be at most ${SEO_LIMITS.robots} characters.` };
  }

  const rawMetas = Array.isArray(input.customMetas) ? input.customMetas : [];
  const customMetas: CustomMeta[] = [];
  for (const raw of rawMetas) {
    if (typeof raw !== "object" || raw === null) return { error: "Invalid meta tag." };
    const record = raw as Record<string, unknown>;
    const attr = record.attr === "property" ? "property" : "name";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!name && !content) continue; // an empty row is dropped, not rejected
    if (!META_NAME.test(name)) return { error: `"${name.slice(0, 40) || "?"}" is not a meta tag name. Examples: theme-color, og:audio.` };
    if (content.length > SEO_LIMITS.metaContent) {
      return { error: `The content of "${name}" can be at most ${SEO_LIMITS.metaContent} characters.` };
    }
    if (/[<>]/.test(content)) return { error: `The content of "${name}" may not contain < or >.` };
    if (!customMetas.some((meta) => meta.attr === attr && meta.name === name && meta.content === content)) {
      customMetas.push({ attr, name, content });
    }
  }
  if (customMetas.length > SEO_LIMITS.metas) {
    return { error: `Add at most ${SEO_LIMITS.metas} custom meta tags.` };
  }

  const codes = {
    googleVerification: verificationCode(text("googleVerification")),
    bingVerification: verificationCode(text("bingVerification")),
    yandexVerification: verificationCode(text("yandexVerification")),
  };
  for (const [key, code] of Object.entries(codes)) {
    if (code.length > SEO_LIMITS.verification || /[<>"'\s]/.test(code)) {
      return { error: `The ${key.replace("Verification", "")} verification code is not valid.` };
    }
  }

  return {
    data: {
      indexing: input.indexing,
      titleSuffix,
      homeTitle,
      homeDescription,
      shareImageUrl,
      shareImageId: shareImageUrl ? text("shareImageId").trim() : "",
      robotsDisallow,
      robotsCustom,
      customMetas,
      ...codes,
    },
  };
}
