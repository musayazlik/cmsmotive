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
  // The store_scoped_content migration leaves a default store in an empty database.
  const store = await db.store.findFirstOrThrow();
  await db.user.create({ data: { id: "destination-admin", name: "Admin", email: "backup-admin@example.com", role: "admin" } });
  await db.session.create({ data: { id: "session", token: "test-token", userId: "destination-admin", expiresAt: new Date("2099-01-01") } });
  const media = await db.mediaAsset.create({ data: { storeId: store.id, key: "image-key", url: "https://example.com/image.png", fileName: "image.png", fileSize: 42, mimeType: "image/png", uploadedById: "destination-admin" } });
  // The products_and_commerce migration seeds the theme/extension product types.
  const type = await db.productType.findUniqueOrThrow({ where: { key: "theme" } });
  const product = await db.product.create({ data: { storeId: store.id, typeId: type.id, name: "Theme", slug: "theme", summary: "Summary", description: "<p>Theme</p>", status: "preview", badge: "In development", position: 10, category: "Agency", technologies: ["TYPO3 13"], coverId: media.id, highlights: ["Fast"], compatibility: [{ area: "TYPO3", target: "13", status: "ready" }], gallery: { create: { assetId: media.id } } } });
  await db.changelogEntry.create({ data: { productId: product.id, version: "1.0", title: "First release", releasedAt: new Date(), changes: [{ kind: "new", text: "Initial release" }] } });
  await db.productReview.create({ data: { storeId: store.id, productId: product.id, productSlug: product.slug, authorName: "Reader", authorEmail: "reader@example.com", rating: 5, body: "Excellent", requestKey: "review", status: "approved" } });
  const category = await db.category.create({ data: { storeId: store.id, name: "News", slug: "news" } });
  const tag = await db.tag.create({ data: { storeId: store.id, name: "Release", slug: "release" } });
  const post = await db.post.create({ data: { storeId: store.id, title: "Post", slug: "post", content: "<p>Saved content</p>", status: "scheduled", scheduledAt: new Date("2099-01-01"), coverId: media.id, authorId: "destination-admin", categoryId: category.id, tags: { create: { tagId: tag.id } } } });
  const root = await db.postComment.create({ data: { postId: post.id, authorName: "Reader", authorEmail: "reader@example.com", body: "Root", requestKey: "root", status: "approved", aiStatus: "passed" } });
  await db.postComment.create({ data: { postId: post.id, parentId: root.id, authorName: "Reader", authorEmail: "reader@example.com", body: "Reply", requestKey: "reply", aiStatus: "checking", aiReviewToken: "in-flight" } });
  await db.contactInquiry.create({ data: { storeId: store.id, name: "Visitor", email: "visitor@example.com", agency: "Agency", typo3Version: "13", license: "Single", message: "Hello" } });
  await db.newsletterSubscriber.create({ data: { storeId: store.id, email: "subscriber@example.com", firstName: "A", lastName: "Reader" } });
  await db.pageViewDaily.create({ data: { storeId: store.id, date: new Date("2026-10-22"), slug: "post", views: 123 } });
  await db.storeDomain.create({ data: { storeId: store.id, host: "backup.example", primary: true } });
  await db.setting.create({ data: { key: "security.panelPath", value: '"/private-workspace"' } });
  await db.storeSetting.createMany({ data: [
    { key: "site.name", value: '"Backed up site"' },
    { key: "telegram.botToken", value: "test-only-credential" },
    { key: "telegram.links", value: JSON.stringify([{ userId: "destination-admin", telegramUserId: 42, chatId: 42, username: null, name: "Admin", linkedAt: new Date().toISOString() }]) },
    { key: "mcp.actor.userId", value: "destination-admin" },
    { key: "mcp.http.enabled", value: "true" },
    { key: "telegram.pairing", value: "temporary-code" },
  ].map((row) => ({ ...row, storeId: store.id })) });

  const raw = await db.$transaction(readBackup, { isolationLevel: "RepeatableRead" });
  const backup = parseBackup(JSON.parse(JSON.stringify(raw)));
  assert.ok(!("sessions" in raw));
  assert.deepEqual(Object.keys(raw.users[0]).sort(), ["email", "id"]);
  assert.equal(backup.data.media.length, 1);
  // Simulate a backup from an installation with different account IDs.
  backup.users[0].id = "source-admin";
  backup.data.posts[0].authorId = "source-admin";
  backup.data.media[0].uploadedById = "source-admin";
  backup.data.storeSettings.find((row) => row.key === "mcp.actor.userId")!.value = "source-admin";
  const links = JSON.parse(backup.data.storeSettings.find((row) => row.key === "telegram.links")!.value);
  links[0].userId = "source-admin";
  backup.data.storeSettings.find((row) => row.key === "telegram.links")!.value = JSON.stringify(links);
  backup.data.comments.reverse();
  await db.newsletterSubscriber.updateMany({ data: { unsubscribedAt: new Date("2026-10-24"), confirmedAt: new Date("2026-10-01") } });
  await db.post.update({ where: { id: post.id }, data: { content: "Changed" } });
  await db.$transaction((tx) => restoreBackup(tx, backup), { timeout: 30_000, isolationLevel: "Serializable" });
  const restored = await db.$transaction(readBackup);
  for (const [key, records] of Object.entries(raw.data)) {
    if (key !== "storeSettings") assert.equal(restored.data[key as keyof typeof restored.data].length, records.length, key);
  }
  assert.ok(restored.data.subscribers[0].unsubscribedAt, "A stale backup cannot erase a withdrawal");
  assert.equal(restored.data.posts[0].content, "<p>Saved content</p>");
  assert.equal(restored.data.posts[0].authorId, "destination-admin");
  assert.equal(restored.data.media[0].uploadedById, "destination-admin");
  assert.deepEqual(restored.data.products[0].compatibility, [{ area: "TYPO3", target: "13", status: "ready" }]);
  assert.deepEqual(restored.data.products[0].technologies, ["TYPO3 13"]);
  assert.equal(restored.data.productGallery[0].assetId, media.id);
  assert.equal(restored.data.products[0].position, 10);
  assert.equal(restored.data.products[0].badge, "In development");
  assert.equal(restored.data.changelog[0].productId, restored.data.products[0].id);
  assert.equal(restored.data.reviews[0].productId, restored.data.products[0].id);
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.parentId, root.id);
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.aiStatus, "pending");
  assert.equal(restored.data.comments.find((row) => row.requestKey === "reply")!.aiReviewToken, null);
  assert.equal(restored.data.storeSettings.find((row) => row.key === "telegram.pairing"), undefined);
  assert.equal(restored.data.settings.length, 1, "Only the panel's security settings are install-wide");
  assert.equal(restored.data.posts[0].storeId, store.id);
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.session.count(), 1);

  const invalid = structuredClone(backup);
  invalid.data.posts[0].categoryId = "does-not-exist";
  await assert.rejects(db.$transaction((tx) => restoreBackup(tx, invalid), { timeout: 30_000 }));
  assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).content, "<p>Saved content</p>");
  assert.equal(await db.product.count(), 1);

  const unmatched = structuredClone(backup);
  unmatched.users[0].email = "missing@example.com";
  await db.$transaction((tx) => restoreBackup(tx, unmatched), { timeout: 30_000 });
  assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).authorId, null);
  const storeValue = async (key: string) => (await db.storeSetting.findUniqueOrThrow({ where: { storeId_key: { storeId: store.id, key } } })).value;
  assert.equal(await storeValue("mcp.http.enabled"), "false");
  assert.equal(await storeValue("telegram.links"), "[]");

  const empty = structuredClone(backup);
  for (const rows of Object.values(empty.data)) rows.length = 0;
  await db.$transaction((tx) => restoreBackup(tx, empty), { timeout: 30_000 });
  const cleared = await db.$transaction(readBackup);
  // Stores, their domains and settings are replaced per store: a backup without stores leaves them in place.
  assert.ok(Object.entries(cleared.data).every(([key, rows]) => ["subscribers", "stores", "storeDomains", "storeSettings"].includes(key) || rows.length === 0));
  assert.equal(cleared.data.storeDomains.length, 1);
  assert.equal(cleared.data.subscribers.length, 1, "Content restoration must preserve subscription/withdrawal history");
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.session.count(), 1);
});
