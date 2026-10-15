import { readFile } from "node:fs/promises";
import path from "node:path";
import { rewriteLegacyHtml } from "./legacy-document";

const sourceRoot = path.join(process.cwd(), "static-site");

export async function readLegacyPage(sourcePath: string) {
  const html = await readFile(path.join(sourceRoot, sourcePath), "utf8");
  return rewriteLegacyHtml(html, sourcePath);
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
