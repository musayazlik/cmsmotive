import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

test("releases reach covered buyers once, reminders fire inside their window once, and read state stays per customer", async () => {
  const schema = `notifications_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const oldDb = globalDb.prisma;
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    for (const dir of (await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await sql.query((await readFile(new URL(`../prisma/migrations/${dir.name}/migration.sql`, import.meta.url), "utf8"))
        .replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
    }
    globalDb.prisma = db;
    const notifications = await import("../lib/notifications");

    const store = await db.store.findFirstOrThrow();
    const type = await db.productType.findFirstOrThrow();
    for (const name of ["covered", "expired", "refunded", "stranger"])
      await db.user.create({ data: { id: `n-${name}`, name, email: `${name}@example.test`, emailVerified: true } });
    const customerOf = (userId: string) => db.customer.create({ data: { storeId: store.id, userId, mode: "test", creemCustomerId: randomUUID(), email: `${userId}@example.test` } });
    const product = await db.product.create({
      data: { storeId: store.id, typeId: type.id, name: "Aurelia", slug: "aurelia", summary: "Fixture", description: "Fixture", highlights: ["x"], technologies: ["TYPO3"] },
    });
    const yearly = await db.price.create({ data: { productId: product.id, name: "Annual", billingType: "recurring", interval: "year", amountCents: 14900 } });
    const oneTime = await db.price.create({ data: { productId: product.id, name: "Single site", billingType: "onetime", amountCents: 7900, updatesMonths: 12 } });

    const now = new Date("2026-10-26T12:00:00Z");
    const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

    // --- release fan-out
    const covered = await customerOf("n-covered");
    const expired = await customerOf("n-expired");
    const refunded = await customerOf("n-refunded");
    const grant = (customerId: string, updatesUntil: Date | null, revokedAt: Date | null = null) =>
      db.entitlement.create({ data: { storeId: store.id, productId: product.id, customerId, updatesUntil, revokedAt } });
    await grant(covered.id, days(200));
    await grant(expired.id, days(-30));
    await grant(refunded.id, null, days(-1));
    const release = await db.productRelease.create({ data: { productId: product.id, version: "2.0.0", fileName: "a.zip", fileKey: "r2://b/a.zip", codeLicense: "GPL-2.0-or-later" } });

    assert.equal(await notifications.announceRelease(release.id), 1, "only the buyer whose update window covers the release is told");
    assert.equal(await notifications.announceRelease(release.id), 0, "a release is announced once");
    assert.equal((await db.productRelease.findUniqueOrThrow({ where: { id: release.id } })).notifiedAt !== null, true);
    const told = await db.notification.findMany({ where: { type: "release.published" } });
    assert.deepEqual(told.map((row) => row.userId), ["n-covered"]);
    assert.deepEqual(told[0].data, { product: "Aurelia", version: "2.0.0" });
    assert.equal(told[0].href, "/account/downloads");

    const later = await db.productRelease.create({ data: { productId: product.id, version: "2.1.0", fileName: "b.zip", fileKey: "r2://b/b.zip", codeLicense: "GPL-2.0-or-later" } });
    assert.equal(await notifications.announcePendingReleases(), 1, "the scheduled job announces releases nobody was told about");
    assert.equal(await notifications.announcePendingReleases(), 0);
    assert.equal((await db.productRelease.findUniqueOrThrow({ where: { id: later.id } })).notifiedAt !== null, true);

    // --- reminders
    const subscription = (customerId: string, status: string, end: Date) =>
      db.subscription.create({
        data: {
          storeId: store.id, customerId, productId: product.id, priceId: yearly.id, creemSubscriptionId: `sub_${randomUUID()}`, mode: "test",
          status, currentPeriodStart: days(-300), currentPeriodEnd: end, providerUpdatedAt: now,
        },
      });
    const renewing = await subscription(covered.id, "active", days(2));
    await subscription(covered.id, "active", days(10));
    const ending = await subscription(expired.id, "scheduled_cancel", days(2));
    await subscription(refunded.id, "canceled", days(2));
    const order = await db.order.create({
      data: { storeId: store.id, customerId: covered.id, productId: product.id, priceId: oneTime.id, creemOrderId: `ord_${randomUUID()}`, mode: "test", type: "onetime", status: "paid", amountCents: 7900, currency: "EUR", placedAt: days(-360) },
    });
    const windowEnd = days(5);
    await db.entitlement.create({ data: { storeId: store.id, productId: product.id, customerId: covered.id, orderId: order.id, updatesUntil: windowEnd } });

    assert.equal(await notifications.queueReminders(now), 3);
    assert.equal(await notifications.queueReminders(now), 0, "a second run creates nothing");
    assert.equal(await notifications.queueReminders(days(1)), 0, "nor does a later run inside the same window");

    const byType = (typeName: string) => db.notification.findMany({ where: { type: typeName } });
    const [renewal] = await byType("subscription.renewal_upcoming");
    assert.equal(renewal.userId, "n-covered");
    assert.deepEqual(renewal.data, { product: "Aurelia", plan: "Annual", date: renewing.currentPeriodEnd.toISOString(), amountCents: 14900, currency: "EUR" });
    const [endNotice] = await byType("subscription.ending_soon");
    assert.equal(endNotice.userId, "n-expired");
    assert.equal((endNotice.data as Record<string, unknown>).amountCents, undefined, "an ending subscription is not charged again");
    assert.equal(ending.status, "scheduled_cancel");
    const [updates] = await byType("updates.expiring");
    assert.equal(updates.userId, "n-covered");
    assert.equal((updates.data as Record<string, unknown>).date, windowEnd.toISOString());
    assert.equal((await byType("subscription.renewal_upcoming")).length, 1, "a subscription 10 days out is not reminded yet");

    // The next period gets its own reminder: renewal moves the end date, so the key changes.
    await db.subscription.update({ where: { id: renewing.id }, data: { currentPeriodEnd: days(367) } });
    assert.equal(await notifications.queueReminders(days(365)), 1);

    // --- webhook-style inserts are idempotent, tolerate deleted accounts and never cross users
    const created = await db.$transaction((tx) =>
      notifications.createNotifications(tx, [
        { storeId: store.id, userId: "n-covered", type: "purchase.confirmed", dedupeKey: "purchase:fixture", data: { product: "Aurelia" } },
        { storeId: store.id, userId: "n-covered", type: "purchase.confirmed", dedupeKey: "purchase:fixture", data: { product: "Aurelia" } },
        { storeId: store.id, userId: "deleted-account", type: "purchase.confirmed", dedupeKey: "purchase:fixture", data: { product: "Aurelia" } },
      ]),
    );
    assert.equal(created, 1);

    // --- reading and read state
    const mine = await notifications.loadNotifications("n-covered", store.id);
    assert.ok(mine.length >= 4);
    assert.equal(await notifications.unreadNotificationCount("n-covered", store.id), mine.length);
    assert.equal(await notifications.unreadNotificationCount("n-stranger", store.id), 0);
    await notifications.markNotificationsRead("n-expired", store.id);
    assert.equal(await notifications.unreadNotificationCount("n-covered", store.id), mine.length, "marking someone else's messages changes nothing");
    await notifications.markNotificationsRead("n-covered", store.id, [mine[0].id]);
    assert.equal(await notifications.unreadNotificationCount("n-covered", store.id), mine.length - 1);
    await notifications.markNotificationsRead("n-stranger", store.id, mine.map((row) => row.id));
    assert.equal(await notifications.unreadNotificationCount("n-covered", store.id), mine.length - 1, "ids of other customers cannot be marked read");
    await notifications.markNotificationsRead("n-covered", store.id);
    assert.equal(await notifications.unreadNotificationCount("n-covered", store.id), 0);

    // --- preferences default to on and persist
    assert.deepEqual(await notifications.loadNotificationPreferences("n-covered"), { emailReleases: true, emailBilling: true });
    await notifications.saveNotificationPreferences("n-covered", { emailReleases: false, emailBilling: true });
    await notifications.saveNotificationPreferences("n-covered", { emailReleases: false, emailBilling: false });
    assert.deepEqual(await notifications.loadNotificationPreferences("n-covered"), { emailReleases: false, emailBilling: false });

    // --- mail is off without Plunk, and leaves everything pending for later
    delete process.env.PLUNK_SECRET_KEY;
    assert.deepEqual(await notifications.deliverPendingEmails(), { sent: 0, skipped: 0, failed: 0 });
    assert.equal(await db.notification.count({ where: { emailState: "pending" } }), await db.notification.count());
  } finally {
    globalDb.prisma = oldDb;
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
