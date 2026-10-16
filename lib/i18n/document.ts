import { translateHtml, type Translate } from "./html";
import { LOCALES, SOURCE_LOCALE, localizePath, type Locale } from "./config";

/**
 * Localizes a static-site document whose links are already root-relative
 * (see rewriteLegacyHtml): translates its copy through `translate`, sets
 * `<html lang>`, prefixes internal links and points the top-bar language
 * menu at `pagePath` in each locale. Pure, so Client Components can use it
 * with bundled catalogs. Served pages get hreflang, canonical and the other
 * search tags from lib/seo.ts afterwards.
 */
export function localizeDocument(html: string, locale: Locale, pagePath: string, translate: Translate): string {
  let out = locale === SOURCE_LOCALE ? html : translateHtml(html, translate);

  out = out.replace(/<html\b([^>]*?)\blang=(["'])[^"']*\2/i, `<html$1lang="${locale}"`);

  // Internal links keep the visitor in their language; the language menu links are set below.
  out = out.replace(/<a\b[^>]*>/gi, (tag) => {
    if (/\bdata-lang=/.test(tag)) return tag;
    return tag.replace(/\bhref=(["'])(\/[^"']*)\1/, (_m, quote: string, href: string) => `href=${quote}${localizePath(href, locale)}${quote}`);
  });

  out = out.replace(/<a\b([^>]*?)\bdata-lang=(["'])(\w+)\2([^>]*)>/gi, (tag, _before, _q, code: string) => {
    if (!(LOCALES as readonly string[]).includes(code)) return tag;
    const target = code as Locale;
    const current = target === locale ? ' aria-current="true"' : "";
    return `<a href="${localizePath(pagePath, target)}" hreflang="${target}" lang="${target}" data-lang="${target}"${current}>`;
  });
  out = out.replace(/(<span\b[^>]*\bdata-lang-current\b[^>]*>)[^<]*/i, `$1${locale.toUpperCase()}`);
  return out;
}
