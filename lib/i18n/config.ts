/**
 * Public-site locales. German is the default and lives at unprefixed URLs
 * (`/themes`); the others carry a prefix (`/en/themes`, `/tr/themes`).
 * The static-site sources are written in English; see lib/i18n/legacy.ts.
 */
export const LOCALES = ["de", "en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";
export const SOURCE_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = { de: "Deutsch", en: "English", tr: "Türkçe" };

/** BCP 47 tags for dates and `og:locale`. */
export const LOCALE_TAGS: Record<Locale, string> = { de: "de-DE", en: "en-US", tr: "tr-TR" };

/** Request header proxy.ts sets so the root layout can render `<html lang>`. */
export const LOCALE_HEADER = "x-site-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

/** Paths that are never localized: assets, APIs, the account area and auth flows. */
const UNLOCALIZED = /^\/(?:assets|api|auth|account|newsletter|panel|_next)(?:[/?#]|$)/;

/** Splits `/en/themes` into `{ locale: "en", path: "/themes" }`; unprefixed paths are German. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const match = pathname.match(/^\/(en|tr|de)(?=\/|$)/);
  if (!match) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
  return { locale: match[1] as Locale, path: pathname.slice(match[0].length) || "/" };
}

/** Prefixes a root-relative site path for `locale` (`/themes` -> `/en/themes`). */
export function localizePath(path: string, locale: Locale, defaultLocale: Locale = DEFAULT_LOCALE): string {
  if (!path.startsWith("/") || path.startsWith("//") || UNLOCALIZED.test(path)) return path;
  if (locale === defaultLocale) return path;
  const cut = path.search(/[?#]/);
  const pathname = cut < 0 ? path : path.slice(0, cut);
  const rest = cut < 0 ? "" : path.slice(cut);
  return pathname === "/" ? `/${locale}${rest}` : `/${locale}${pathname}${rest}`;
}
