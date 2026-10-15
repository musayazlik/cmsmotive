import { loadCatalog } from "./catalog";
import { localizeDocument } from "./document";
import type { Locale } from "./config";

/** Absolute origin for hreflang alternates; relative URLs when it is not configured. */
function siteOrigin() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "";
  return origin.replace(/\/+$/, "");
}

/**
 * Prepares a static-site page (already passed through rewriteLegacyHtml, so
 * links are root-relative) for `locale` using the server-side catalog.
 * `pagePath` is the page's unprefixed public path (`/`, `/themes`).
 */
export function localizeLegacyHtml(html: string, locale: Locale, pagePath: string): string {
  const catalog = loadCatalog(locale);
  return localizeDocument(html, locale, pagePath, (key) => catalog.get(key), siteOrigin());
}
