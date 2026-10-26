import { readFile } from "node:fs/promises";
import path from "node:path";
import { withFontPreloads } from "./fonts";
import { rewriteLegacyHtml } from "./legacy-document";

const sourceRoot = path.join(process.cwd(), "static-site");

/**
 * The reveal animation (`.js [data-reveal]`) must hold elements hidden from the
 * first paint. site.js adds `js` to <html> only after parsing (deferred), so
 * without this hero and other reveal blocks flash visible, then hide and fade
 * in — the split-second rewrite below puts the class in the head immediately.
 */
const REVEAL_GATE = "<script>document.documentElement.classList.add('js')</script>";

function withRevealGate(html: string): string {
  return html.replace(
    // `(\s[^>]*)?` stops the tag at whitespace, so <header> never matches.
    /(<head(?:\s[^>]*)?>)/i,
    (_match, head: string) => `${head}${REVEAL_GATE}`,
  );
}

export async function readLegacyPage(sourcePath: string) {
  const html = await readFile(path.join(sourceRoot, sourcePath), "utf8");
  return withRevealGate(withFontPreloads(rewriteLegacyHtml(html, sourcePath)));
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
