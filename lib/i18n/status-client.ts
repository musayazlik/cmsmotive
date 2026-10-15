import deIndex from "@/i18n/legacy/de/index.json";
import deStatus from "@/i18n/legacy/de/status.json";
import trIndex from "@/i18n/legacy/tr/index.json";
import trStatus from "@/i18n/legacy/tr/status.json";
import untranslated from "@/i18n/legacy/untranslated.json";
import { splitLocale, type Locale } from "./config";
import { localizeDocument } from "./document";

/**
 * Catalogs for the client-side error boundaries (app/error.tsx), which cannot
 * read i18n/ from disk: the status page copy plus the shared chrome (top bar,
 * header, newsletter, footer), which lives in the home page catalog.
 */
const CATALOGS: Partial<Record<Locale, Record<string, string>>> = {
  de: { ...deIndex, ...deStatus },
  tr: { ...trIndex, ...trStatus },
};
const KEEP = new Set<string>(untranslated);

/** Localizes a status document's root-relative HTML for the language in `pathname`. */
export function localizeStatusHtml(html: string, pathname: string) {
  const { locale, path } = splitLocale(pathname);
  const catalog = CATALOGS[locale] ?? {};
  return { locale, html: localizeDocument(html, locale, path, (key) => catalog[key] ?? (KEEP.has(key) ? key : undefined)) };
}
