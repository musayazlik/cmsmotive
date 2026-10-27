import assert from "node:assert/strict";
import { test } from "node:test";
import { filterPages, type PageLocaleRow, type PageRow } from "../app/panel/pages/_lib";

const locale = (language: string, title: string, status: PageLocaleRow["status"]): PageLocaleRow => ({
  locale: language, title, status, version: 1, publishedAt: null, updatedByName: null, previewPath: "/preview",
});

const rows: PageRow[] = [
  { id: "about", kind: "page", slug: "about-us", updatedAt: "2026-10-27T00:00:00Z", locales: [locale("en", "About us", "published"), locale("tr", "Hakkımızda", "draft")] },
  { id: "home", kind: "home", slug: "", updatedAt: "2026-10-27T00:00:00Z", locales: [locale("en", "Welcome", "published")] },
  { id: "sale", kind: "landing", slug: "autumn-sale", updatedAt: "2026-10-27T00:00:00Z", locales: [locale("en", "Autumn", "scheduled")] },
  { id: "empty", kind: "page", slug: "empty", updatedAt: "2026-10-27T00:00:00Z", locales: [] },
];

test("home stays first without reordering the input or other pages", () => {
  assert.deepEqual(filterPages(rows, "", "all").map((row) => row.id), ["home", "about", "sale", "empty"]);
  assert.deepEqual(rows.map((row) => row.id), ["about", "home", "sale", "empty"]);
});

test("search covers translated titles and addresses, ignoring case and surrounding spaces", () => {
  assert.deepEqual(filterPages(rows, " Hakkımızda ", "all").map((row) => row.id), ["about"]);
  assert.deepEqual(filterPages(rows, "/AUTUMN-SALE", "all").map((row) => row.id), ["sale"]);
});

test("status matches any language and combines with search", () => {
  assert.deepEqual(filterPages(rows, "", "draft").map((row) => row.id), ["about"]);
  assert.deepEqual(filterPages(rows, "", "published").map((row) => row.id), ["home", "about"]);
  assert.deepEqual(filterPages(rows, "Autumn", "published"), []);
  assert.deepEqual(filterPages([], "", "all"), []);
});
