import assert from "node:assert/strict";
import { test } from "node:test";
import type { z } from "zod";
import { BACKUP_FORMAT, BACKUP_TABLE_LABELS, BACKUP_VERSION } from "../lib/backup-shared";
import { backupSchema, parseBackup, summarizeBackup } from "../lib/backup-validation";

const now = "2026-10-22T10:00:00.000Z";
function empty(): z.input<typeof backupSchema> {
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now, users: [],
    data: { themes: [], extensions: [], themeGallery: [], extensionGallery: [], changelog: [], media: [], posts: [], categories: [], tags: [], postTags: [], comments: [], reviews: [], inquiries: [], subscribers: [], pageViews: [], settings: [] },
  };
}
const post = { id: "post", title: "A post", slug: "a-post", excerpt: "", content: "<p>Content</p>", coverId: null, status: "published", scheduledAt: null, featured: false, readingTime: 2, publishedAt: now, authorId: null, categoryId: null, createdAt: now, updatedAt: now };
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
  assert.throws(() => parseBackup({ ...empty(), version: 2 }), /unsupported/);
  assert.throws(() => parseBackup({ ...empty(), accounts: [{ password: "secret" }] }), /unsupported/);
  assert.throws(() => parseBackup({ ...empty(), createdAt: "yesterday" }), /createdAt/);
  const backup = empty();
  backup.data.posts.push({ ...post, createdAt: "invalid" });
  assert.throws(() => parseBackup(backup), /createdAt/);
});

test("dates round-trip and post content is preserved verbatim", () => {
  const backup = empty();
  backup.data.posts.push(post);
  const parsed = parseBackup(backup);
  assert.ok(parsed.data.posts[0].createdAt instanceof Date);
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(parsed))), parsed);
  assert.equal(parsed.data.posts[0].content, post.content);
});

test("media supports seeded local assets and storage URLs, rejecting executable URLs", () => {
  for (const url of ["/assets/images/theme.webp", "https://example.com/image.png", "javascript:alert(1)", "//evil.example/image.png"]) {
    const backup = empty();
    backup.data.media.push({ id: "media", key: "key", url, fileName: "image.png", fileSize: 1, mimeType: "image/png", alt: null, width: null, height: null, uploadedById: null, createdAt: now });
    if (url.startsWith("/assets/") || url.startsWith("https:")) assert.equal(parseBackup(backup).data.media[0].url, url);
    else assert.throws(() => parseBackup(backup), /media.0.url/);
  }
});

test("duplicate IDs, slugs, settings and composite links are rejected", () => {
  const backup = empty();
  backup.data.posts.push(post, { ...post, id: "other" });
  assert.throws(() => parseBackup(backup), /Duplicate posts slug/);
  backup.data.posts[1].slug = "other";
  backup.data.posts[1].id = "post";
  assert.throws(() => parseBackup(backup), /Duplicate posts ID/);
  const settings = empty();
  settings.data.settings.push({ key: "site.name", value: '"Site"', updatedAt: now }, { key: "site.name", value: '"Other"', updatedAt: now });
  assert.throws(() => parseBackup(settings), /Duplicate setting/);
  const links = empty();
  links.data.postTags.push({ postId: "p", tagId: "t" }, { postId: "p", tagId: "t" });
  assert.throws(() => parseBackup(links), /Duplicate post tag/);
});

test("dangling foreign keys are rejected before restoring", () => {
  for (const field of ["coverId", "authorId", "categoryId"] as const) {
    const backup = empty();
    backup.data.posts.push({ ...post, [field]: "missing" });
    assert.throws(() => parseBackup(backup), /Missing .* reference/);
  }
});

test("comment replies accept any source order but reject cross-post parents and cycles", () => {
  const backup = empty();
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

test("product reviews and release notes must reference exactly one existing product", () => {
  const backup = empty();
  backup.data.changelog.push({ id: "release", themeId: null, extensionId: null, version: "1.0", title: "Release", releasedAt: now, changes: [], createdAt: now, updatedAt: now });
  assert.throws(() => parseBackup(backup), /exactly one product/);
  backup.data.changelog[0].themeId = "missing";
  assert.throws(() => parseBackup(backup), /Missing theme reference/);
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
