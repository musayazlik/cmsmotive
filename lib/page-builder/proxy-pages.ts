import fs from "node:fs";
import type { StorePageRegistry } from "./registry";

/**
 * Where the proxy sends a public page path (plan 5.8). The `[[...slug]]`
 * catch-all under app/[locale] matches almost everything, so the proxy —
 * which runs BEFORE all filesystem routes — decides what each page path
 * becomes:
 *
 * - unprefixed published page slug → `/{defaultLocale}/{slug}` (the catch-all renders it),
 * - renamed addresses 301 from the old slug to the new one (PageRedirect table),
 * - paths the builder does not own keeps today's behavior: React routes fill
 *   their locale prefix, static-site pages go to `/legacy/{locale}/{slug}`,
 * - prefixed requests in another store locale stay untouched — the catch-all
 *   renders a published version itself (plan 5.8),
 * - `/{defaultLocale}/...` shortens to the unprefixed canonical address (301, P1).
 *
 * Pure function over plain data, unit tested without Next (plan 8).
 */

/** React route prefixes with prefixed URLs (app/[locale]/...). */
export const REACT_PAGE_SLUGS = ["blog", "products", "imprint", "privacy", "terms", "cookies"] as const;
/** React prefixes that accept subpaths (`/blog/<slug>`, `/products/<slug>`). */
const REACT_SUBPATH_SLUGS = new Set(["blog", "products"]);

export type PagePathDecision =
  | { action: "rewrite"; destination: string; locale: string }
  | { action: "redirect"; destination: string; permanent: boolean }
  | { action: "untouched" };

const UNTOUCHED: PagePathDecision = { action: "untouched" };

export type DecidePagePathStore = { defaultLocale: string; locales: string[] };

export function decidePagePath(args: {
  pathname: string;
  method: string;
  store: DecidePagePathStore;
  registry: StorePageRegistry;
  /** static-site HTML slugs minus the React routes, `404`/`500`/`loading` and `index`. */
  legacySlugs: ReadonlySet<string>;
}): PagePathDecision {
  if (args.method !== "GET" && args.method !== "HEAD") return UNTOUCHED;
  const normalized = args.pathname.replace(/\/+$/, "") || "/";
  const segments = normalized.split("/").filter(Boolean);
  const store = args.store;

  const prefersLegacyIndex = (locale: string): PagePathDecision => ({
    action: "rewrite",
    destination: `/legacy/${locale}/index`,
    locale,
  });

  // Home page: builder-home inheritance is Faz 3; until then `/` keeps the
  // legacy index of the store's default language.
  if (segments.length === 0) return prefersLegacyIndex(store.defaultLocale);

  const [first, ...rest] = segments;
  const remainder = rest.join("/");
  const restFirst = rest[0] ?? "";
  const prefixedLocales = new Set(store.locales);
  const isPublished = (slug: string, locale: string) =>
    args.registry.pages.some((page) => page.slug === slug && page.locales.includes(locale));
  /**
   * 301 table from page renamings (plan 5.8); their targets land on live
   * content. `prefix` keeps the locale the request arrived on (null → the
   * unprefixed canonical address).
   */
  const redirectOf = (fromSlug: string, prefix: string | null) => {
    const entry = args.registry.redirects.find((candidate) => candidate.fromSlug === fromSlug);
    if (!entry) return null;
    return {
      action: "redirect" as const,
      destination: prefix ? `/${prefix}/${entry.toSlug}` : `/${entry.toSlug}`,
      permanent: true,
    };
  };

  if (!prefixedLocales.has(first)) {
    // Unprefixed page path (never matches a store locale — `/black-friday`).
    // Without a locale prefix the full path IS the page slug, subpaths included.
    const slug = segments.join("/");
    const unprefixedBuilder = isPublished(slug, store.defaultLocale);
    if (unprefixedBuilder) {
      return { action: "rewrite", destination: `/${store.defaultLocale}/${slug}`, locale: store.defaultLocale };
    }
    const renamed = redirectOf(slug, null);
    if (renamed) return renamed;
    if (REACT_SUBPATH_SLUGS.has(first) && rest.length > 0) {
      return { action: "rewrite", destination: `/${store.defaultLocale}/${first}/${remainder}`, locale: store.defaultLocale };
    }
    if (REACT_PAGE_SLUGS.includes(first as (typeof REACT_PAGE_SLUGS)[number]) && rest.length === 0) {
      return { action: "rewrite", destination: `/${store.defaultLocale}/${first}`, locale: store.defaultLocale };
    }
    if (args.legacySlugs.has(first)) {
      return { action: "rewrite", destination: `/legacy/${store.defaultLocale}/${first}`, locale: store.defaultLocale };
    }
    return UNTOUCHED;
  }

  // The store's default locale stays unprefixed (next.config redirects every
  // `/{defaultLocale}/...` request). P1: anything published unprefixed goes by
  // its canonical address.
  if (first === store.defaultLocale) {
    if (remainder === "") return { action: "redirect", destination: "/", permanent: true };
    if (
      isPublished(remainder, store.defaultLocale) ||
      args.legacySlugs.has(restFirst) ||
      REACT_PAGE_SLUGS.includes(restFirst as (typeof REACT_PAGE_SLUGS)[number]) ||
      REACT_SUBPATH_SLUGS.has(restFirst)
    ) {
      return { action: "redirect", destination: `/${remainder}`, permanent: true };
    }
    const renamed = redirectOf(remainder, null);
    if (renamed) return renamed;
    return UNTOUCHED;
  }

  // Another store locale: the catch-all answers published pages directly
  // (plan 5.8); the proxy fills in the legacy index and legacy HTML slugs.
  if (remainder === "") return prefersLegacyIndex(first);
  if (remainder === "index" || REACT_PAGE_SLUGS.includes(restFirst as (typeof REACT_PAGE_SLUGS)[number])) return UNTOUCHED;
  const renamed = redirectOf(remainder, first);
  if (renamed) return renamed;
  if (args.legacySlugs.has(restFirst)) {
    return { action: "rewrite", destination: `/legacy/${first}/${remainder}`, locale: first };
  }
  return UNTOUCHED;
}

/**
 * Static-site slugs the legacy route may serve, mirroring next.config.ts's
 * list (React routes, status documents and `index` are excluded; `index` is
 * only reachable through the `/` rewrite).
 */
export function listLegacyPageSlugs(): Set<string> {
  const slugs = new Set<string>();
  try {
    const files = fs.readdirSync(`${process.cwd()}/static-site`) as string[];
    for (const file of files) {
      if (!/^[a-z0-9-]+\.html$/.test(file)) continue;
      const slug = file.slice(0, -5);
      if (["404", "500", "loading"].includes(slug) || REACT_PAGE_SLUGS.includes(slug as (typeof REACT_PAGE_SLUGS)[number])) continue;
      if (slug !== "index") slugs.add(slug);
    }
  } catch {
    // The list is an optimization only; unknown slugs fall through to 404.
  }
  return slugs;
}
