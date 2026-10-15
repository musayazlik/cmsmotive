import { loadAppCatalog } from "./catalog";
import { SOURCE_LOCALE, type Locale } from "./config";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

const ENTITIES: Record<string, string> = {
  nbsp: String.fromCodePoint(0xa0),
  shy: String.fromCodePoint(0xad),
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: String.fromCodePoint(0x2019),
};

/** Catalog values are HTML text; React renders plain strings. */
function decodeEntities(text: string) {
  return text.replace(/&(#\d+|[a-z]+);/gi, (match, name: string) =>
    name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? match),
  );
}

/**
 * `t("Explore themes")` for the React pages: looks the English source text up
 * in the same catalog the static-site pages use (plus i18n/app/<locale>.json)
 * and falls back to the source text. `{name}` placeholders are filled from `vars`.
 */
export function getTranslator(locale: Locale): Translate {
  const catalog = locale === SOURCE_LOCALE ? null : loadAppCatalog(locale);
  return (key, vars) => {
    let text = catalog?.get(key) ?? key;
    if (catalog && !catalog.has(key) && process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing ${locale} translation: ${JSON.stringify(key)}`);
    }
    if (vars) text = text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
    return decodeEntities(text);
  };
}
