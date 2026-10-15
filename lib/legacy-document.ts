/**
 * Pure helpers for the static-site HTML (no fs), so Client Components such
 * as the error boundaries can use them on documents imported as raw strings.
 */

function rewriteUrl(value: string, sourcePath: string) {
  if (/^(?:#|mailto:|tel:|https?:|data:|javascript:)/i.test(value)) return value;
  const url = new URL(value, `https://cmsmotive.local/${sourcePath}`);
  let pathname = url.pathname;
  if (pathname === "/index.html") pathname = "/";
  else if (pathname.endsWith(".html")) pathname = pathname.slice(0, -5);
  return `${pathname}${url.search}${url.hash}`;
}

/** Relative `assets/…` and `page.html` links become root-relative, extensionless URLs. */
export function rewriteLegacyHtml(html: string, sourcePath: string) {
  return html.replace(/\b(href|src)=(['"])(.*?)\2/g, (_match, attribute: string, quote: string, value: string) =>
    `${attribute}=${quote}${rewriteUrl(value, sourcePath)}${quote}`,
  );
}

export type LegacyDocument = {
  title: string;
  stylesheets: string[];
  /** External scripts, in document order, removed from `body`. */
  scripts: string[];
  /** Everything inside <body>, minus the external scripts. */
  body: string;
  /** Everything inside <main id="main">, for rendering inside another frame. */
  main: string;
};

/** Splits a built static-site page into the parts a React tree can render. */
export function parseLegacyDocument(raw: string, sourcePath: string): LegacyDocument {
  const html = rewriteLegacyHtml(raw, sourcePath);
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, " ").trim() ?? "CMSMotive";
  const stylesheets = [...head.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\brel=["']stylesheet["']/i.test(tag))
    .map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter((href): href is string => Boolean(href));

  const scripts: string[] = [];
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "").replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (_tag, src: string) => {
      scripts.push(src);
      return "";
    },
  );
  const main = body.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? body;

  return { title, stylesheets, scripts, body, main };
}
