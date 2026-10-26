import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

test("customer downloads span owned stores, merge access and protect private packages", async (t) => {
  const schema = `downloads_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const oldDb = globalDb.prisma;
  const envKeys = ["CREEM_MODE", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    for (const dir of (await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await sql.query((await readFile(new URL(`../prisma/migrations/${dir.name}/migration.sql`, import.meta.url), "utf8"))
        .replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
    }
    globalDb.prisma = db;
    process.env.CREEM_MODE = "test";
    Object.assign(process.env, {
      R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "fixture-access",
      R2_SECRET_ACCESS_KEY: "fixture-secret", R2_BUCKET_NAME: "private-packages",
    });
    const { loadCustomerDownloads } = await import("../lib/customer-downloads");
    const { loadCustomerLibrary } = await import("../lib/customer-library");
    const primary = await db.store.findFirstOrThrow();
    const secondary = await db.store.create({ data: { key: "downloads-secondary", name: "Second store" } });
    const type = await db.productType.findFirstOrThrow();
    const buyer = await db.user.create({ data: { id: "download-buyer", name: "Buyer", email: "downloads@example.test", emailVerified: true } });
    await db.user.create({ data: { id: "other-buyer", name: "Other buyer", email: "other@example.test", emailVerified: true } });

    async function customer(storeId: string, userId = buyer.id, mode = "test") {
      return db.customer.create({ data: { storeId, userId, mode, creemCustomerId: randomUUID(), email: "fixture@example.test" } });
    }
    async function product(storeId: string, name: string) {
      return db.product.create({ data: { storeId, typeId: type.id, name, slug: name.toLowerCase().replaceAll(" ", "-"), summary: "Fixture", description: "Fixture", highlights: ["Included product feature"], technologies: ["Next.js"] } });
    }
    const primaryCustomer = await customer(primary.id);
    const secondaryCustomer = await customer(secondary.id);
    const otherCustomer = await customer(secondary.id, "other-buyer");
    const liveCustomer = await customer(primary.id, buyer.id, "prod");
    const emptyProduct = await product(primary.id, "No package");
    const packaged = await product(secondary.id, "Purchased package");
    const refunded = await product(primary.id, "Refunded");
    const liveProduct = await product(primary.id, "Live purchase");
    const otherProduct = await product(secondary.id, "Someone elses purchase");
    const grant = (productId: string, storeId: string, customerId: string, updatesUntil: Date | null = null, revokedAt: Date | null = null) =>
      db.entitlement.create({ data: { productId, storeId, customerId, updatesUntil, revokedAt } });
    await grant(emptyProduct.id, primary.id, primaryCustomer.id);
    await grant(packaged.id, secondary.id, secondaryCustomer.id, new Date("2026-06-01"));
    await grant(packaged.id, secondary.id, secondaryCustomer.id, new Date("2026-02-01"));
    // Another buyer's wider access must never expand this buyer's version coverage.
    await grant(packaged.id, secondary.id, otherCustomer.id);
    await grant(otherProduct.id, secondary.id, otherCustomer.id);
    await grant(refunded.id, primary.id, primaryCustomer.id, null, new Date("2026-01-01"));
    await grant(liveProduct.id, primary.id, liveCustomer.id);
    const releases = [];
    for (const [version, createdAt] of [["1.0", "2026-01-01"], ["2.0", "2026-03-01"], ["3.0", "2026-11-01"]]) {
      releases.push(await db.productRelease.create({ data: { productId: packaged.id, version, createdAt: new Date(createdAt), fileName: `package-${version}.zip`, fileKey: `r2://private-packages/packages/fixture/${version}.zip`, codeLicense: "MIT" } }));
    }
    const products = await loadCustomerDownloads(buyer.id, "test");
    assert.deepEqual(new Set(products.map((entry) => entry.id)), new Set([emptyProduct.id, packaged.id]));
    const files = products.find((entry) => entry.id === packaged.id)!;
    assert.equal(files.storeName, "Second store");
    assert.deepEqual(files.files.map((file) => file.version), ["2.0", "1.0"]);
    assert.equal(files.packageCount, 3);
    assert.equal(products.find((entry) => entry.id === emptyProduct.id)?.packageCount, 0);
    assert.ok(files.files.every((file) => !("fileKey" in file)));
    assert.deepEqual(await loadCustomerDownloads("unknown-user", "test"), []);
    assert.deepEqual((await loadCustomerDownloads(buyer.id, "prod")).map((entry) => entry.id), [liveProduct.id]);

    // The library presents each purchased plan separately, including its own update coverage.
    const library = await loadCustomerLibrary(buyer.id, "test");
    assert.deepEqual(new Set(library.map((entry) => entry.name)), new Set([emptyProduct.name, packaged.name, refunded.name]));
    const packages = library.filter((entry) => entry.name === packaged.name);
    assert.equal(packages.length, 2);
    assert.deepEqual(new Set(packages.map((entry) => entry.releases.filter((release) => release.available).map((release) => release.version).join(","))), new Set(["2.0,1.0", "1.0"]));
    assert.equal(packages[0].releases[0].version, "3.0");
    assert.equal(packages[0].releases[0].createdAt, "2026-11-01T00:00:00.000Z");
    assert.equal(packages[0].store, "Second store");
    assert.deepEqual(packages[0].features, ["Included product feature"]);
    assert.deepEqual(packages[0].technologies, ["Next.js"]);
    assert.ok(packages.every((entry) => entry.releases.every((release) => !("fileKey" in release))));
    const revoked = library.find((entry) => entry.name === refunded.name)!;
    assert.equal(revoked.revoked, true);
    assert.equal(revoked.updatesActive, false);
    assert.deepEqual(revoked.licenses, []);
    assert.deepEqual(await loadCustomerLibrary("unknown-user", "test"), []);
    assert.deepEqual((await loadCustomerLibrary(buyer.id, "prod")).map((entry) => entry.name), [liveProduct.name]);

    await t.test("dashboard counts unique products and files, isolates payments and checks subscription periods", async () => {
      const { loadCustomerDashboard } = await import("../lib/customer-dashboard");
      const now = new Date("2026-10-26");
      const price = await db.price.create({ data: { productId: packaged.id, name: "Dashboard annual", billingType: "recurring", amountCents: 9900 } });
      let scheduledId = "";
      for (const [status, end, revoked] of [
        ["scheduled_cancel", "2026-11-01", false],
        ["active", "2026-10-26", false],
        ["active", "2026-12-01", true],
      ] as const) {
        const subscription = await db.subscription.create({ data: {
          storeId: secondary.id, customerId: secondaryCustomer.id, productId: packaged.id, priceId: price.id,
          creemSubscriptionId: randomUUID(), mode: "test", status,
          currentPeriodStart: new Date("2026-01-01"), currentPeriodEnd: new Date(end), providerUpdatedAt: now,
        } });
        if (status === "scheduled_cancel") scheduledId = subscription.id;
        await db.entitlement.create({ data: {
          storeId: secondary.id, customerId: secondaryCustomer.id, productId: packaged.id, subscriptionId: subscription.id,
          updatesUntil: new Date("2026-06-01"), revokedAt: revoked ? now : null,
        } });
      }
      for (let index = 1; index <= 6; index++) {
        await db.transaction.create({ data: {
          storeId: secondary.id, customerId: secondaryCustomer.id, mode: "test", creemTransactionId: `dashboard-${index}`,
          type: "payment", status: "completed", amountCents: index * 100, currency: index % 2 ? "EUR" : "USD",
          occurredAt: new Date(`2026-10-${20 + index}`),
        } });
      }
      for (const customer of [otherCustomer, liveCustomer]) {
        await db.transaction.create({ data: {
          storeId: customer.storeId, customerId: customer.id, mode: customer.mode, creemTransactionId: randomUUID(),
          type: "payment", status: "completed", amountCents: 99900, currency: "EUR", occurredAt: new Date("2026-10-28"),
        } });
      }
      const result = await loadCustomerDashboard(buyer.id, "test", now);
      assert.equal(result.productCount, 2);
      assert.equal(result.fileCount, 2);
      assert.equal(result.awaitingPackageCount, 1);
      assert.equal(result.activeSubscriptionCount, 1);
      assert.deepEqual(result.subscriptions.map((entry) => entry.id), [scheduledId]);
      assert.deepEqual(result.latestFiles.map((file) => file.version), ["2.0", "1.0"]);
      assert.deepEqual(result.payments.map((payment) => payment.amountCents), [600, 500, 400, 300]);
      assert.ok(result.latestFiles.every((file) => !("fileKey" in file)));
      const empty = await loadCustomerDashboard("unknown-user", "test", now);
      assert.equal(empty.productCount, 0);
      assert.equal(empty.activeSubscriptionCount, 0);
      assert.deepEqual(empty.latestFiles, []);
      assert.deepEqual(empty.payments, []);
    });

    const { auth } = await import("../lib/auth");
    const { GET } = await import("../app/api/downloads/[id]/route");
    let userId = buyer.id;
    let signedIn = true;
    let verified = true;
    t.mock.method(auth.api, "getSession", async () => signedIn ? { user: { ...buyer, id: userId, emailVerified: verified } } : null);
    const download = (id: string) => GET(new Request(`http://localhost/api/downloads/${id}`), { params: Promise.resolve({ id }) });
    signedIn = false;
    assert.equal((await download(releases[0].id)).status, 401);
    signedIn = true;
    verified = false;
    assert.equal((await download(releases[0].id)).status, 401);
    verified = true;
    userId = "unknown-user";
    assert.equal((await download(releases[0].id)).status, 403);
    userId = buyer.id;
    assert.equal((await download(releases[2].id)).status, 403);
    assert.equal((await download("missing-release")).status, 404);
    const response = await download(releases[0].id);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const location = new URL(response.headers.get("Location")!);
    assert.equal(location.searchParams.get("X-Amz-Expires"), "60");
    assert.match(location.searchParams.get("response-content-disposition")!, /^attachment;/);
    process.env.CREEM_MODE = "live";
    assert.equal((await download(releases[0].id)).status, 403);
    process.env.CREEM_MODE = "test";
    await db.entitlement.updateMany({ where: { productId: packaged.id, customerId: secondaryCustomer.id }, data: { revokedAt: new Date() } });
    assert.equal((await download(releases[0].id)).status, 403);
    assert.ok((await loadCustomerDownloads(buyer.id, "test")).every((entry) => entry.id !== packaged.id));
  } finally {
    globalDb.prisma = oldDb;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
