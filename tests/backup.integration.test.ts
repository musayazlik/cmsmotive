import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { readBackup, restoreBackup } from "../lib/backup";
import { parseBackup } from "../lib/backup-validation";
import { prisma as applicationPrisma } from "../lib/prisma";

// A separate schema contains every test write, including deletes and failed restores.
const schema = `backup_test_${randomUUID().replaceAll("-", "")}`;
const connectionString = process.env.DATABASE_URL!;
const sql = new Client({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
let connected = false;
let created = false;

before(async () => {
  await sql.connect();
  connected = true;
  await sql.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await sql.query(`SET search_path TO "${schema}"`);
  const migrations = await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true });
  for (const migration of migrations.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = await readFile(new URL(`../prisma/migrations/${migration.name}/migration.sql`, import.meta.url), "utf8");
    await sql.query(source.replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
  }
});

after(async () => {
  await db.$disconnect();
  await applicationPrisma.$disconnect();
  if (created) await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
  if (connected) await sql.end();
});

test("all CMS tables round-trip with relationships, empty sections replace data, authentication stays intact, and failures roll back", async () => {
  await db.user.create({ data: { id: "destination-admin", name: "Admin", email: "backup-admin@example.com", role: "admin" } });
  await db.session.create({ data: { id: "session", token: "test-token", userId: "destination-admin", expiresAt: new Date("2099-01-01") } });
  const media = await db.mediaAsset.create({ data: { key: "image-key", url: "https://example.com/image.png", fileName: "image.png", fileSize: 42, mimeType: "image/png", uploadedById: "destination-admin" } });
  const theme = await db.theme.create({ data: { name: "Theme", slug: "theme", summary: "Summary", description: "<p>Theme</p>", industry: "Agency", versionTarget: "13", coverId: media.id, highlights: ["Fast"], compatibility: [{ area: "TYPO3", target: "13", status: "ready" }], licences: [{ name: "Single", price: 12 }], gallery: { create: { assetId: media.id } } } });
  const extension = await db.extension.create({ data: { name: "Extension", slug: "extension", summary: "Summary", description: "<p>Extension</p>", coverId: media.id, compatibility: [], gallery: { create: { assetId: media.id } } } });
  await db.changelogEntry.create({ data: { themeId: theme.id, version: "1.0", title: "First release", releasedAt: new Date(), changes: [{ kind: "new", text: "Initial release" }] } });
  await db.productReview.create({ data: { extensionId: extension.id, productSlug: extension.slug, authorName: "Reader", authorEmail: "reader@example.com", rating: 5, body: "Excellent", requestKey: "review", status: "approved" } });
  const category = await db.category.create({ data: { name: "News", slug: "news" } });
  const tag = await db.tag.create({ data: { name: "Release", slug: "release" } });
  const post = await db.post.create({ data: { title: "Post", slug: "post", content: "<p>Saved content</p>", status: "scheduled", scheduledAt: new Date("2099-01-01"), coverId: media.id, authorId: "destination-admin", categoryId: category.id, tags: { create: { tagId: tag.id } } } });
  const root = await db.postComment.create({ data: { postId: post.id, authorName: "Reader", authorEmail: "reader@example.com", body: "Root", requestKey: "root", status: "approved", aiStatus: "passed" } });
  await db.postComment.create({ data: { postId: post.id, parentId: root.id, authorName: "Reader", authorEmail: "reader@example.com", body: "Reply", requestKey: "reply", aiStatus: "checking", aiReviewToken: "in-flight" } });
  await db.contactInquiry.create({ data: { name: "Visitor", email: "visitor@example.com", agency: "Agency", typo3Version: "13", license: "Single", message: "Hello" } });
  await db.newsletterSubscriber.create({ data: { email: "subscriber@example.com", firstName: "A", lastName: "Reader" } });
  await db.pageViewDaily.create({ data: { date: new Date("2026-10-22"), slug: "post", views: 123 } });
  await db.setting.createMany({ data: [
    { key: "site.name", value: '"Backed up site"' },
    { key: "security.panelPath", value: '"/private-workspace"' },
    { key: "telegram.botToken", value: "test-only-credential" },
    { key: "telegram.links", value: JSON.stringify([{ userId: "destination-admin", telegramUserId: 42, chatId: 42, username: null, name: "Admin", linkedAt: new Date().toISOString() }]) },
    { key: "mcp.actor.userId", value: "destination-admin" },
    { key: "mcp.http.enabled", value: "true" },
    { key: "telegram.pairing", value: "temporary-code" },
  ] });

  const raw = await db.$transaction(readBackup, { isolationLevel: "RepeatableRead" });
  const backup = parseBackup(JSON.parse(JSON.stringify(raw)));
  assert.ok(!("sessions" in raw));
  assert.deepEqual(Object.keys(raw.users[0]).sort(), ["email", "id"]);
  assert.equal(backup.data.media.length, 1);
  // Simulate a backup from an installation with different account IDs.
  backup.users[0].id = "source-admin";
  backup.data.posts[0].authorId = "source-admin";
  backup.data.media[0].uploadedById = "source-admin";
  backup.data.settings.find((row) => row.key === "mcp.actor.userId")!.value = "source-admin";
  const links = JSON.parse(backup.data.settings.find((row) => row.key === "telegram.links")!.value);
  links[0].userId = "source-admin";
  backup.data.settings.find((row) => row.key === "telegram.links")!.value = JSON.stringify(links);
  backup.data.comments.reverse();
  await db.post.update({ where: { id: post.id }, data: { content: "Changed" } });
  await db.$transaction((tx) => restoreBackup(tx, backup), { timeout: 30_000, isolationLevel: "Serializable" });
  const restored = await db.$transaction(readBackup);
  for (const [key, records] of Object.entries(raw.data)) {
    if (key !== "settings") assert.equal(restored.data[key as keyof typeof restored.data].length, records.length, key);
  }
  assert.equal(restored.data.posts[0].content, "<p>Saved content</p>");
  assert.equal(restored.data.posts[0].authorId, "destination-admin");
  assert.equal(restored.data.media[0].uploadedById, "destination-admin");
  assert.deepEqual(restored.data.themes[0].licences, [{ name: "Single", price: 12 }]);
  assert.equal(restored.data.themeGallery[0].assetId, media.id);
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.parentId, root.id);
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.aiStatus, "pending");
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.aiReviewToken, null);
  assert.equal(restored.data.settings.find((row) => row.key === "telegram.pairing"), undefined);
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.session.count(), 1);

  const invalid = structuredClone(backup);
  invalid.data.posts[0].categoryId = "does-not-exist";
  await assert.rejects(db.$transaction((tx) => restoreBackup(tx, invalid), { timeout: 30_000 }));
  assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).content, "<p>Saved content</p>");
  assert.equal(await db.theme.count(), 1);

  const unmatched = structuredClone(backup);
  unmatched.users[0].email = "missing@example.com";
  await db.$transaction((tx) => restoreBackup(tx, unmatched), { timeout: 30_000 });
  assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).authorId, null);
  assert.equal((await db.setting.findUniqueOrThrow({ where: { key: "mcp.http.enabled" } })).value, "false");
  assert.equal((await db.setting.findUniqueOrThrow({ where: { key: "telegram.links" } })).value, "[]");

  const empty = structuredClone(backup);
  for (const rows of Object.values(empty.data)) rows.length = 0;
  await db.$transaction((tx) => restoreBackup(tx, empty), { timeout: 30_000 });
  const cleared = await db.$transaction(readBackup);
  assert.ok(Object.values(cleared.data).every((rows) => rows.length === 0));
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.session.count(), 1);
});
