import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Locale } from "./config";

/**
 * Translations are flat `{ "English source text": "translation" }` maps:
 *
 * - i18n/legacy/<locale>/*.json — every string of the static-site pages
 *   (split by page only to keep the files readable; all files of a locale
 *   are merged). Run `pnpm i18n:check` after editing a page.
 * - i18n/legacy/untranslated.json — brand names and code kept as written.
 * - i18n/app/<locale>.json — strings that only the React pages use
 *   (app/[locale]/blog); those pages also reuse the static-site strings.
 *
 * Keys and values are HTML text as it appears in the static pages, so
 * entities such as `&nbsp;` stay encoded (see lib/i18n/translate.ts).
 */
const i18nRoot = path.join(process.cwd(), "i18n");

const cache = new Map<string, Map<string, string>>();

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function addEntries(catalog: Map<string, string>, entries: Record<string, string>) {
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "string" && value !== "") catalog.set(key, value);
  }
}

function cached(name: string, build: () => Map<string, string>) {
  const hit = cache.get(name);
  if (hit) return hit;
  const catalog = build();
  // Re-read on every request in development so catalog edits show up without a restart.
  if (process.env.NODE_ENV === "production") cache.set(name, catalog);
  return catalog;
}

/** Static-site strings for `locale`, including the untranslated brand/code list. */
export function loadCatalog(locale: Locale): Map<string, string> {
  return cached(`legacy:${locale}`, () => {
    const dir = path.join(i18nRoot, "legacy", locale);
    const untranslated = readJson<string[]>(path.join(i18nRoot, "legacy", "untranslated.json"), []);
    const catalog = new Map<string, string>(untranslated.map((key) => [key, key]));
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const file of files) addEntries(catalog, readJson(path.join(dir, file), {}));
    return catalog;
  });
}

/** Static-site strings plus the React-only strings for `locale`. */
export function loadAppCatalog(locale: Locale): Map<string, string> {
  return cached(`app:${locale}`, () => {
    const catalog = new Map(loadCatalog(locale));
    addEntries(catalog, readJson(path.join(i18nRoot, "app", `${locale}.json`), {}));
    return catalog;
  });
}
