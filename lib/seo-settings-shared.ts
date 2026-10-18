/**
 * Client-safe contract for Settings → SEO: whether search engines may index
 * the site, the title suffix, the fallback share image and the ownership
 * verification codes of the search consoles.
 */

export type SeoSettings = {
  /** Off = robots.txt disallows everything and every public page is noindex (staging). */
  indexing: boolean;
  /** Appended to page titles, e.g. " — CMSMotive"; "" for bare titles. */
  titleSuffix: string;
  /** Open Graph / X image for pages without their own; "" = the bundled default. */
  shareImageUrl: string;
  shareImageId: string;
  /** Extra robots.txt Disallow paths next to the built-in ones. */
  robotsDisallow: string[];
  googleVerification: string;
  bingVerification: string;
  yandexVerification: string;
};

/** The suffix the static pages and translations are written with. */
export const DEFAULT_TITLE_SUFFIX = " — CMSMotive";

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  indexing: true,
  titleSuffix: DEFAULT_TITLE_SUFFIX,
  shareImageUrl: "",
  shareImageId: "",
  robotsDisallow: [],
  googleVerification: "",
  bingVerification: "",
  yandexVerification: "",
};

/** Always disallowed, whatever the settings say (app/robots.ts). */
export const BUILT_IN_DISALLOW = ["/panel", "/auth/", "/api/", "/legacy/"];

export const SEO_LIMITS = { titleSuffix: 40, disallowPaths: 30, verification: 100 } as const;

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
      shareImageUrl,
      shareImageId: shareImageUrl ? text("shareImageId").trim() : "",
      robotsDisallow,
      ...codes,
    },
  };
}
