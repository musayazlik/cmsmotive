/**
 * Translation catalog check for the static-site pages.
 *
 *   pnpm i18n:check            list keys missing from i18n/legacy/<locale>/*.json
 *   pnpm i18n:check --write    also write the missing keys, grouped by page, to i18n/legacy/_missing/<locale>.json
 *
 * Keys are collected with the same walker the server uses (lib/i18n/html.ts).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectKeys } from "../lib/i18n/html";
import { LOCALES, SOURCE_LOCALE } from "../lib/i18n/config";
import { loadCatalog } from "../lib/i18n/catalog";

const root = process.cwd();
const siteDir = path.join(root, "static-site");
const pages = readdirSync(siteDir)
  .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
  .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));

const firstSeen = new Map<string, string>();
for (const file of pages) {
  for (const key of collectKeys(readFileSync(path.join(siteDir, file), "utf8"))) {
    if (!firstSeen.has(key)) firstSeen.set(key, file.slice(0, -5));
  }
}

const write = process.argv.includes("--write");
let failed = false;
for (const locale of LOCALES.filter((l) => l !== SOURCE_LOCALE)) {
  const catalog = loadCatalog(locale);
  const missing: Record<string, Record<string, string>> = {};
  let count = 0;
  for (const [key, page] of firstSeen) {
    if (catalog.has(key)) continue;
    (missing[page] ??= {})[key] = "";
    count++;
  }
  const unused = [...catalog.keys()].filter((key) => !firstSeen.has(key));
  console.log(`${locale}: ${firstSeen.size - count}/${firstSeen.size} translated, ${count} missing, ${unused.length} unused`);
  if (unused.length) console.log(`  unused: ${unused.map((key) => JSON.stringify(key)).join(", ")}`);
  if (count) failed = true;
  if (write) {
    mkdirSync(path.join(root, "i18n/legacy/_missing"), { recursive: true });
    writeFileSync(path.join(root, `i18n/legacy/_missing/${locale}.json`), JSON.stringify(missing, null, 2) + "\n");
  }
}
process.exitCode = failed ? 1 : 0;
