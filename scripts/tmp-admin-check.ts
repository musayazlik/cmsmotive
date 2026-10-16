/**
 * Throwaway check for the signed-in admin-panel link in the static top bar:
 * injection applied, placed before the social icons, translated per locale and
 * never locale-prefixed (panel lives outside [locale]).
 */
import { readFileSync } from "node:fs";
import { injectAdminPanelLink } from "../lib/legacy";
import { rewriteLegacyHtml } from "../lib/legacy-document";
import { localizeLegacyHtml } from "../lib/i18n/legacy";

const raw = readFileSync("static-site/themes.html", "utf8");
const base = rewriteLegacyHtml(raw, "themes.html");

const occurrences = base.split('class="topbar-social"').length - 1;
if (occurrences !== 1) throw new Error(`expected 1 topbar-social, got ${occurrences}`);

const injected = injectAdminPanelLink(base);
if (injected === base) throw new Error("injection did not apply");
if (injected.indexOf("topbar-admin") > injected.indexOf('class="topbar-social"')) {
  throw new Error("admin link is not before the social icons");
}

for (const locale of ["de", "en", "tr"] as const) {
  const out = localizeLegacyHtml(injected, locale, "/themes");
  const anchor = out.match(/<a class="topbar-admin"[^>]*>/)?.[0] ?? "MISSING";
  const prefixed = /href="\/(?:de|en|tr)\/panel"/.test(out);
  const labelHtml = out.match(/<\/span><\/a><ul class="topbar-social"/) ? "ok" : "MISSING";
  console.log(`${locale}: ${anchor}`);
  console.log(`  href prefixed: ${prefixed} | span before social ul: ${labelHtml}`);
}
