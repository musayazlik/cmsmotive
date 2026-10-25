import assert from "node:assert/strict";
import { test } from "node:test";
import type { z } from "zod";
import { BACKUP_FORMAT, BACKUP_TABLE_LABELS, BACKUP_VERSION } from "../lib/backup-shared";
import { backupSchema, parseBackup, summarizeBackup } from "../lib/backup-validation";

const now = "2026-10-22T10:00:00.000Z";
function empty(): z.input<typeof backupSchema> {
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now, users: [],
    data: { stores: [], storeDomains: [], storeSettings: [], productTypes: [], products: [], productStores: [], productGallery: [], changelog: [], media: [], posts: [], categories: [], tags: [], postTags: [], comments: [], reviews: [], inquiries: [], subscribers: [], pageViews: [], settings: [] },
  };
}
const store = { id: "store", key: "main", name: "Main store", defaultLocale: "en", locales: ["en"], isDefault: true, createdAt: now, updatedAt: now };
/** An empty backup that carries one store, for sections whose rows belong to a store. */
function withStore(): z.input<typeof backupSchema> {
  const backup = empty();
  backup.data.stores.push(store);
  return backup;
}
const productType = { id: "type-theme", key: "theme", name: "Theme", pluralName: "Themes", description: null, listPath: "/themes", position: 0, createdAt: now, updatedAt: now };
const product = { id: "product", storeId: "store", typeId: "type-theme", slug: "nordform", name: "Nordform", summary: "A precise visual system.", description: "<p>Product</p>", status: "concept", category: "Agency", technologies: ["TYPO3 13"], listPrice: 269, compliance: {}, tagline: null, intro: null, highlights: [], compatibility: [], ctaLabel: null, ctaUrl: null, demoUrl: null, coverId: null, createdAt: now, updatedAt: now };
const review = { id: "review", storeId: "store", productId: "product", productSlug: "nordform", authorName: "Reader", authorEmail: "reader@example.com", rating: 5, body: "Excellent", status: "approved", locale: "en", requestKey: "review-key", moderatedAt: now, createdAt: now };
const post = { id: "post", storeId: "store", title: "A post", slug: "a-post", excerpt: "", content: "<p>Content</p>", coverId: null, status: "published", scheduledAt: null, featured: false, readingTime: 2, publishedAt: now, authorId: null, categoryId: null, createdAt: now, updatedAt: now };
const comment = { id: "comment", postId: "post", parentId: null, authorName: "Reader", authorEmail: "reader@example.com", body: "A comment", status: "approved", locale: "en", requestKey: "comment-key", moderatedAt: now, aiStatus: "passed", aiNote: null, aiModel: null, aiCheckedAt: null, aiReviewToken: null, createdAt: now };

test("empty backups are valid and explicitly describe every replaceable section", () => {
  const backup = parseBackup(empty());
  const summary = summarizeBackup(backup);
  assert.deepEqual(Object.keys(summary.counts).sort(), Object.keys(BACKUP_TABLE_LABELS).sort());
  assert.ok(Object.values(summary.counts).every((count) => count === 0));
  assert.equal(summary.panelPath, "/panel");
  const missing = empty();
  Reflect.deleteProperty(missing.data, "settings");
  assert.throws(() => parseBackup(missing), /settings/);
});

test("unsupported versions, extra authentication data and invalid dates are rejected", () => {
  assert.throws(() => parseBackup({ ...empty(), version: 1 }), /unsupported/);
  assert.throws(() => parseBackup({ ...empty(), accounts: [{ password: "secret" }] }), /unsupported/);
  assert.throws(() => parseBackup({ ...empty(), createdAt: "yesterday" }), /createdAt/);
  const backup = withStore();
  backup.data.posts.push({ ...post, createdAt: "invalid" });
  assert.throws(() => parseBackup(backup), /createdAt/);
});

test("dates round-trip and post content is preserved verbatim", () => {
  const backup = withStore();
  backup.data.posts.push(post);
  const parsed = parseBackup(backup);
  assert.ok(parsed.data.posts[0].createdAt instanceof Date);
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(parsed))), parsed);
  assert.equal(parsed.data.posts[0].content, post.content);
});

test("media supports seeded local assets and storage URLs, rejecting executable URLs", () => {
  for (const url of ["/assets/images/theme.webp", "https://example.com/image.png", "javascript:alert(1)", "//evil.example/image.png"]) {
    const backup = withStore();
    backup.data.media.push({ id: "media", storeId: "store", key: "key", url, fileName: "image.png", fileSize: 1, mimeType: "image/png", alt: null, width: null, height: null, uploadedById: null, createdAt: now });
    if (url.startsWith("/assets/") || url.startsWith("https:")) assert.equal(parseBackup(backup).data.media[0].url, url);
    else assert.throws(() => parseBackup(backup), /media.0.url/);
  }
});

test("duplicate IDs, slugs, settings and composite links are rejected", () => {
  const backup = withStore();
  backup.data.posts.push(post, { ...post, id: "other" });
  assert.throws(() => parseBackup(backup), /Duplicate posts slug/);
  backup.data.posts[1].slug = "other";
  backup.data.posts[1].id = "post";
  assert.throws(() => parseBackup(backup), /Duplicate posts ID/);
  const settings = withStore();
  settings.data.storeSettings.push({ storeId: "store", key: "site.name", value: '"Site"', updatedAt: now }, { storeId: "store", key: "site.name", value: '"Other"', updatedAt: now });
  assert.throws(() => parseBackup(settings), /Duplicate store setting/);
  // The same slug in two stores is fine; a store setting outside the shared table is not.
  const twoStores = withStore();
  twoStores.data.stores.push({ ...store, id: "other-store", key: "other", isDefault: false });
  twoStores.data.posts.push(post, { ...post, id: "other", storeId: "other-store" });
  assert.equal(parseBackup(twoStores).data.posts.length, 2);
  const shared = empty();
  shared.data.settings.push({ key: "site.name", value: '"Site"', updatedAt: now });
  assert.throws(() => parseBackup(shared), /install-wide/);
  const links = empty();
  links.data.postTags.push({ postId: "p", tagId: "t" }, { postId: "p", tagId: "t" });
  assert.throws(() => parseBackup(links), /Duplicate post tag/);
});

test("dangling foreign keys are rejected before restoring", () => {
  for (const field of ["coverId", "authorId", "categoryId", "storeId"] as const) {
    const backup = withStore();
    backup.data.posts.push({ ...post, [field]: "missing" });
    assert.throws(() => parseBackup(backup), /Missing .* reference/);
  }
});

test("comment replies accept any source order but reject cross-post parents and cycles", () => {
  const backup = withStore();
  backup.data.posts.push(post);
  backup.data.comments.push({ ...comment, id: "reply", requestKey: "reply-key", parentId: "comment" }, comment);
  assert.equal(parseBackup(backup).data.comments.length, 2);
  backup.data.comments[1].parentId = "reply";
  assert.throws(() => parseBackup(backup), /cycle/);
  backup.data.comments[1].parentId = null;
  backup.data.comments[1].postId = "other-post";
  backup.data.posts.push({ ...post, id: "other-post", slug: "other-post" });
  assert.throws(() => parseBackup(backup), /Invalid comment parent/);
});

test("catalogue rows must reference existing types, covers, products and stores", () => {
  const backup = withStore();
  backup.data.productTypes.push(productType);
  backup.data.products.push({ ...product, typeId: "missing" });
  assert.throws(() => parseBackup(backup), /Missing product type reference/);
  backup.data.products[0].typeId = productType.id;
  backup.data.products[0].coverId = "missing";
  assert.throws(() => parseBackup(backup), /Missing cover image reference/);
  backup.data.products[0].coverId = null;
  backup.data.productStores.push({ productId: product.id, storeId: "missing", position: 10, createdAt: now });
  assert.throws(() => parseBackup(backup), /Missing store reference/);
  backup.data.productStores[0].storeId = "store";
  backup.data.changelog.push({ id: "release", productId: "missing", version: "1.0", title: "Release", releasedAt: now, changes: [], createdAt: now, updatedAt: now });
  assert.throws(() => parseBackup(backup), /Missing product reference/);
  backup.data.changelog[0].productId = product.id;
  backup.data.reviews.push({ ...review, productId: "missing" });
  assert.throws(() => parseBackup(backup), /Missing product reference/);
  backup.data.reviews[0].productId = product.id;
  assert.equal(parseBackup(backup).data.reviews[0].productSlug, review.productSlug);
});

test("product slugs are global, and type keys, listings and gallery links cannot repeat", () => {
  const catalogue = withStore();
  catalogue.data.productTypes.push(productType, { ...productType, id: "type-extension", key: "extension" });
  assert.equal(parseBackup(catalogue).data.productTypes.length, 2);
  catalogue.data.productTypes[1].key = "theme";
  assert.throws(() => parseBackup(catalogue), /Duplicate product type key/);
  catalogue.data.productTypes[1].key = "extension";
  catalogue.data.products.push(product);
  assert.equal(parseBackup(catalogue).data.products.length, 1);
  // The same slug in two stores is fine for posts, but product slugs are unique across stores.
  catalogue.data.stores.push({ ...store, id: "other-store", key: "other", isDefault: false });
  catalogue.data.products.push({ ...product, id: "other", storeId: "other-store" });
  assert.throws(() => parseBackup(catalogue), /Duplicate product slug/);
  catalogue.data.products[1].slug = "other";
  assert.equal(parseBackup(catalogue).data.products.length, 2);
  // A product can be listed in several stores, but only once per store.
  catalogue.data.productStores.push({ productId: product.id, storeId: "store", position: 10, createdAt: now });
  assert.equal(parseBackup(catalogue).data.productStores.length, 1);
  catalogue.data.productStores.push({ productId: product.id, storeId: "other-store", position: 0, createdAt: now });
  assert.equal(parseBackup(catalogue).data.productStores.length, 2);
  catalogue.data.productStores[1].storeId = "store";
  assert.throws(() => parseBackup(catalogue), /Duplicate store listing/);
  // One gallery row per product and image.
  const gallery = withStore();
  gallery.data.productTypes.push(productType);
  gallery.data.products.push(product);
  gallery.data.media.push({ id: "media", storeId: "store", key: "key", url: "/assets/images/cover.webp", fileName: "cover.webp", fileSize: 1, mimeType: "image/webp", alt: null, width: null, height: null, uploadedById: null, createdAt: now });
  gallery.data.productGallery.push({ id: "gallery-1", productId: product.id, assetId: "media", position: 0 });
  assert.equal(parseBackup(gallery).data.productGallery.length, 1);
  gallery.data.productGallery.push({ id: "gallery-2", productId: product.id, assetId: "media", position: 1 });
  assert.throws(() => parseBackup(gallery), /Duplicate product gallery link/);
});

test("private panel paths are validated and included in preview", () => {
  for (const value of ['"/api"', '"https://evil.example"', "invalid", '"/ab"']) {
    const backup = empty();
    backup.data.settings.push({ key: "security.panelPath", value, updatedAt: now });
    assert.throws(() => parseBackup(backup), /Invalid panel address/);
  }
  const backup = empty();
  backup.data.settings.push({ key: "security.panelPath", value: '"/workspace-42"', updatedAt: now });
  assert.equal(summarizeBackup(parseBackup(backup)).panelPath, "/workspace-42");
});
