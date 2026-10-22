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

/** Four-tile grid icon for the admin-panel link (matches TopBar in app/[locale]/_components/site-chrome.tsx). */
const ADMIN_PANEL_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"></rect></svg>';

/**
 * Adds the admin-panel link signed-in visitors see, at the left of the social
 * icons — the static-page twin of TopBar's `showAdmin` branch. Runs before
 * localization, so the label and aria-label translate with the page.
 */
export function injectAdminPanelLink(html: string, panelPath = "/panel", label = "Admin panel"): string {
  const safeLabel = label.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const link = `<a class="topbar-admin" href="${panelPath}" aria-label="${safeLabel}">${ADMIN_PANEL_ICON}<span>${safeLabel}</span></a>`;
  return html.replace('<ul class="topbar-social"', `${link}<ul class="topbar-social"`);
}

/** The static-page counterpart of the maintenance notice in SiteFrame. */
export function injectMaintenanceNotice(html: string, message: string): string {
  const safeMessage = message.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const notice = `<div class="maintenance-notice" role="status"><p class="container">${safeMessage}</p></div>`;
  return html.replace('<div class="topbar">', `${notice}<div class="topbar">`);
}
