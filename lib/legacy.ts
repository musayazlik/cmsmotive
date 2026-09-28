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
  return html.replace(/\b(href|src)=(['"])(.*?)\2/g, (_match, attribute: string, quote: string, value: string) =>
    `${attribute}=${quote}${rewriteUrl(value, sourcePath)}${quote}`,
  );
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
