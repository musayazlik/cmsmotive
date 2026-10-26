import { readFile } from "node:fs/promises";
import path from "node:path";
import { withFontPreloads } from "./fonts";
import { rewriteLegacyHtml } from "./legacy-document";

const sourceRoot = path.join(process.cwd(), "static-site");

export async function readLegacyPage(sourcePath: string) {
  const html = await readFile(path.join(sourceRoot, sourcePath), "utf8");
  return withFontPreloads(rewriteLegacyHtml(html, sourcePath));
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The static-page counterpart of the maintenance notice in SiteFrame. */
export function injectMaintenanceNotice(html: string, message: string): string {
  const safeMessage = message.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const notice = `<div class="maintenance-notice" role="status"><p class="container">${safeMessage}</p></div>`;
  return html.replace('<div class="topbar">', `${notice}<div class="topbar">`);
}
