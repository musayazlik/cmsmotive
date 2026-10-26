import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePagePath, listLegacyPageSlugs, REACT_PAGE_SLUGS } from "../lib/page-builder/proxy-pages";
import type { StorePageRegistry } from "../lib/page-builder/registry";

/**
 * The proxy's pure page-path map (plan 5.8): every public URL the builder
 * catch-all could swallow gets an explicit decision. The store mirrors the
 * seed's TYPO3 store (de default, en/tr prefixed).
 */

const store = { defaultLocale: "de", locales: ["de", "en", "tr"] };

const legacySlugs = new Set(["about", "contact", "pricing", "docs"]);

const registry: StorePageRegistry = {
  pages: [
    { slug: "black-friday", kind: "landing", locales: ["de", "en", "tr"] },
    { slug: "en-only", kind: "landing", locales: ["en"] },
    { slug: "campus/widget", kind: "page", locales: ["de", "en"] },
  ],
  redirects: [
    { fromSlug: "old-name", toSlug: "black-friday" },
    { fromSlug: "deep/old", toSlug: "campus/widget" },
  ],
};

const decide = (pathname: string, method = "GET", overrides: Partial<Parameters<typeof decidePagePath>[0]> = {}) =>
  decidePagePath({ pathname, method, store, registry, legacySlugs, ...overrides });

/* ------------------------------------------------------------------ legacy flow (unchanged behavior) */

test("the root and locale roots serve the legacy index of each language", () => {
  assert.deepEqual(decide("/"), { action: "rewrite", destination: "/legacy/de/index", locale: "de" });
  assert.deepEqual(decide("/en"), { action: "rewrite", destination: "/legacy/en/index", locale: "en" });
  assert.deepEqual(decide("/tr"), { action: "rewrite", destination: "/legacy/tr/index", locale: "tr" });
});

test("static-site pages and the React routes keep today's locale fill", () => {
  assert.deepEqual(decide("/about"), { action: "rewrite", destination: "/legacy/de/about", locale: "de" });
  assert.deepEqual(decide("/en/about"), { action: "rewrite", destination: "/legacy/en/about", locale: "en" });
  assert.deepEqual(decide("/blog"), { action: "rewrite", destination: "/de/blog", locale: "de" });
  assert.deepEqual(decide("/blog/my-post"), { action: "rewrite", destination: "/de/blog/my-post", locale: "de" });
  assert.deepEqual(decide("/products"), { action: "rewrite", destination: "/de/products", locale: "de" });
  assert.deepEqual(decide("/products/cms"), { action: "rewrite", destination: "/de/products/cms", locale: "de" });
  assert.deepEqual(decide("/imprint"), { action: "rewrite", destination: "/de/imprint", locale: "de" });
});

test("prefixed URLs the catch-all owns stay untouched", () => {
  assert.deepEqual(decide("/en/blog"), { action: "untouched" });
  assert.deepEqual(decide("/tr/blog/my-post"), { action: "untouched" });
  assert.deepEqual(decide("/en/pricing"), { action: "rewrite", destination: "/legacy/en/pricing", locale: "en" });
});

test("unknown paths stay untouched so the catch-all 404s", () => {
  assert.deepEqual(decide("/no-such-page"), { action: "untouched" });
  assert.deepEqual(decide("/en/no-such-page"), { action: "untouched" });
  assert.deepEqual(decide("/de/no-such-page"), { action: "untouched" });
});

/* ------------------------------------------------------------------ builder pages */

test("published builder slugs rewrite into the default locale for the catch-all", () => {
  assert.deepEqual(decide("/black-friday"), { action: "rewrite", destination: "/de/black-friday", locale: "de" });
  assert.deepEqual(decide("/campus/widget"), { action: "rewrite", destination: "/de/campus/widget", locale: "de" });
  // The trailing slash is normalized before matching.
  assert.deepEqual(decide("/black-friday/"), { action: "rewrite", destination: "/de/black-friday", locale: "de" });
});

test("a slug published only in a prefixed locale stays untouched for that prefix", () => {
  assert.deepEqual(decide("/en/en-only"), { action: "untouched" });
  // The unprefixed address has no de version, so nothing rewrites: the catch-all 404s.
  assert.deepEqual(decide("/en-only"), { action: "untouched" });
});

test("prefixed builder URLs reach the catch-all untouched", () => {
  assert.deepEqual(decide("/en/black-friday"), { action: "untouched" });
  assert.deepEqual(decide("/tr/campus/widget"), { action: "untouched" });
});

/* ------------------------------------------------------------------ canonical 301s (P1) */

test("the default-locale prefix shortens to the unprefixed canonical address", () => {
  assert.deepEqual(decide("/de"), { action: "redirect", destination: "/", permanent: true });
  assert.deepEqual(decide("/de/about"), { action: "redirect", destination: "/about", permanent: true });
  assert.deepEqual(decide("/de/blog/my-post"), { action: "redirect", destination: "/blog/my-post", permanent: true });
  assert.deepEqual(decide("/de/black-friday"), { action: "redirect", destination: "/black-friday", permanent: true });
  // Unknown second segments are left to the catch-all (404), not redirected.
  assert.deepEqual(decide("/de/no-such-page"), { action: "untouched" });
});

/* ------------------------------------------------------------------ rename redirects (PageRedirect) */

test("old addresses 301 to the page's current address", () => {
  assert.deepEqual(decide("/old-name"), { action: "redirect", destination: "/black-friday", permanent: true });
  assert.deepEqual(decide("/en/old-name"), { action: "redirect", destination: "/en/black-friday", permanent: true });
  assert.deepEqual(decide("/de/old-name"), { action: "redirect", destination: "/black-friday", permanent: true });
  assert.deepEqual(decide("/campus/old"), { action: "untouched" });
  assert.deepEqual(decide("/deep/old"), { action: "redirect", destination: "/campus/widget", permanent: true });
});

/* ------------------------------------------------------------------ guards */

test("document loads only: other methods pass through", () => {
  assert.deepEqual(decide("/black-friday", "POST"), { action: "untouched" });
  assert.deepEqual(decide("/about", "PUT"), { action: "untouched" });
  assert.deepEqual(decide("/black-friday", "HEAD"), {
    action: "rewrite",
    destination: "/de/black-friday",
    locale: "de",
  });
});

test("an empty registry (database hiccup) still rewrites the legacy flow", () => {
  const empty: StorePageRegistry = { pages: [], redirects: [] };
  assert.deepEqual(decide("/black-friday", "GET", { registry: empty }), { action: "untouched" });
  assert.deepEqual(decide("/about", "GET", { registry: empty }), {
    action: "rewrite",
    destination: "/legacy/de/about",
    locale: "de",
  });
  assert.deepEqual(decide("/blog", "GET", { registry: empty }), { action: "rewrite", destination: "/de/blog", locale: "de" });
  assert.deepEqual(decide("/", "GET", { registry: empty }), { action: "rewrite", destination: "/legacy/de/index", locale: "de" });
});

/* ------------------------------------------------------------------ legacy slug list */

test("the legacy slug list mirrors static-site minus react, status and index pages", () => {
  const slugs = listLegacyPageSlugs();
  assert.ok(slugs.has("about"));
  for (const react of REACT_PAGE_SLUGS) assert.ok(!slugs.has(react), react);
  for (const status of ["404", "500", "loading", "index"]) assert.ok(!slugs.has(status), status);
});
