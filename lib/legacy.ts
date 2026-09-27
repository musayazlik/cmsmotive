import { readFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.join(process.cwd(), "static-site");

function rewriteUrl(value: string, sourcePath: string) {
  if (/^(?:#|mailto:|tel:|https?:|data:|javascript:)/i.test(value)) return value;
  const url = new URL(value, `https://cmsmotive.local/${sourcePath}`);
  let pathname = url.pathname;
  if (pathname === "/index.html") pathname = "/";
  else if (pathname.endsWith(".html")) pathname = pathname.slice(0, -5);
  return `${pathname}${url.search}${url.hash}`;
}

export async function readLegacyPage(sourcePath: string) {
  const html = await readFile(path.join(sourceRoot, sourcePath), "utf8");
  let output = html.replace(/\b(href|src)=(['"])(.*?)\2/g, (_match, attribute: string, quote: string, value: string) =>
    `${attribute}=${quote}${rewriteUrl(value, sourcePath)}${quote}`,
  );
  if (!sourcePath.startsWith("auth/")) {
    output = output
      .replace('<div class="header-actions">', '<div class="header-actions"><a class="account-link" href="/panel">Account <span aria-hidden="true">↗</span></a>')
      .replace('<nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation">', '<nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation"><a href="/panel">Account ↗</a>');
  }
  return output;
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
