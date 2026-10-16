import { loadAppCatalog } from "./catalog";
import { localizeDocument } from "./document";
import type { Locale } from "./config";

/**
 * Prepares a static-site page (already passed through rewriteLegacyHtml, so
 * links are root-relative) for `locale` using the server-side catalog.
 * `pagePath` is the page's unprefixed public path (`/`, `/themes`).
 */
export function localizeLegacyHtml(html: string, locale: Locale, pagePath: string): string {
  // Includes i18n/app strings: pages also carry database-driven copy (lib/catalog.ts).
  const catalog = loadAppCatalog(locale);
  return localizeDocument(html, locale, pagePath, (key) => catalog.get(key));
}
