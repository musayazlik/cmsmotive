import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

test("account self-service: plan upgrades, renewals, licence installations, support threads, data export and deletion", async (t) => {
  const schema = `account_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const oldDb = globalDb.prisma;
  const previous = { mode: process.env.CREEM_MODE, key: process.env.CREEM_API_KEY, plunk: process.env.PLUNK_SECRET_KEY };
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
    process.env.CREEM_API_KEY = "creem_test_fixture";
    delete process.env.PLUNK_SECRET_KEY;

    const billing = await import("../lib/customer-billing");
    const support = await import("../lib/support");
    const accountData = await import("../lib/account-data");
    const { loadCustomerLibrary } = await import("../lib/customer-library");

    const store = await db.store.findFirstOrThrow();
    const type = await db.productType.findFirstOrThrow();
    const buyer = await db.user.create({ data: { id: "self-buyer", name: "Ada Buyer", email: "ada@example.test", emailVerified: true } });
    await db.user.create({ data: { id: "other", name: "Other", email: "other@example.test", emailVerified: true } });
    const customer = await db.customer.create({ data: { storeId: store.id, userId: buyer.id, mode: "test", creemCustomerId: "cust_ada", email: buyer.email, name: buyer.name } });
    const product = await db.product.create({
      data: { storeId: store.id, typeId: type.id, name: "Aurelia", slug: "aurelia", summary: "Fixture", description: "Fixture", issueLicenseKeys: true },
    });
    const plan = (name: string, amountCents: number, seats: number, extra: Record<string, unknown> = {}) =>
      db.price.create({ data: { productId: product.id, name, billingType: "recurring", interval: "year", amountCents, seats, enabled: true, creemTestProductId: `prod_${name.toLowerCase()}`, ...extra } });
    const single = await plan("Single", 14900, 1);
    const agency = await plan("Agency", 29900, 5);
    await plan("Hidden", 49900, 10, { enabled: false });
    await plan("Unconfigured", 59900, 20, { creemTestProductId: null });
    await plan("Monthly", 39900, 10, { interval: "month" });

    const subscription = await db.subscription.create({
      data: {
        storeId: store.id, customerId: customer.id, productId: product.id, priceId: single.id, creemSubscriptionId: "sub_ada", mode: "test",
        status: "active", currentPeriodStart: new Date("2026-01-01"), currentPeriodEnd: new Date("2027-01-01"), providerUpdatedAt: new Date("2026-01-01"),
      },
    });
    const subscriptionGrant = await db.entitlement.create({
      data: { storeId: store.id, customerId: customer.id, productId: product.id, subscriptionId: subscription.id, seats: 1, updatesUntil: subscription.currentPeriodEnd },
    });
    const ownKey = await db.licenseKey.create({ data: { entitlementId: subscriptionGrant.id, key: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE", status: "active", activationLimit: 1, mode: "test" } });

    // --- upgrade options: same product and interval, enabled, configured, bigger; never for someone else
    const options = await billing.loadUpgradeOptions(buyer.id, subscription.id);
    assert.deepEqual(options?.options.map((option) => option.name), ["Agency"]);
    assert.equal(await billing.loadUpgradeOptions("other", subscription.id), null);
    assert.deepEqual(await billing.upgradeSubscription(buyer.id, subscription.id, single.id), { ok: false, reason: "not-allowed" });

    // --- upgrade: Creem is asked to move the subscription, then the local record follows its product
    const calls: { url: string; body: unknown }[] = [];
    let creemProduct = "prod_single";
    t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/upgrade")) {
        creemProduct = "prod_agency";
        return Response.json({ id: "sub_ada", object: "subscription", status: "active" });
      }
      if (url.includes("/v1/subscriptions?subscription_id=")) {
        return Response.json({
          id: "sub_ada", product: creemProduct, customer: "cust_ada", mode: "test", status: "active",
          current_period_start_date: "2026-01-01T00:00:00Z", current_period_end_date: "2027-01-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        });
      }
      if (url.includes("/instances")) {
        return Response.json({
          items: [
            { id: "ins_1", name: "example.com", status: "active", created_at: "2026-02-01T00:00:00Z", mode: "test", object: "license-instance" },
            { id: "ins_2", name: "old.example.com", status: "deactivated", created_at: "2026-01-05T00:00:00Z", mode: "test", object: "license-instance" },
          ],
          pagination: { next_page: null },
        });
      }
      if (url.includes("/v1/licenses/deactivate")) return Response.json({ id: "lic_1", key: "CREEM-KEY", status: "active", activation: 0, mode: "test" });
      return new Response("unexpected", { status: 500 });
    });
    assert.deepEqual(await billing.upgradeSubscription(buyer.id, subscription.id, agency.id), { ok: true });
    const upgradeCall = calls.find((call) => call.url.includes("/v1/subscriptions/sub_ada/upgrade"));
    assert.deepEqual(upgradeCall?.body, { product_id: "prod_agency", update_behavior: "proration-charge-immediately" });
    const moved = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id }, include: { entitlement: true } });
    assert.equal(moved.priceId, agency.id);
    assert.equal(moved.entitlement?.seats, 5, "the plan's installations follow the upgrade");
    assert.equal((await db.licenseKey.findUniqueOrThrow({ where: { id: ownKey.id } })).activationLimit, 5);
    const changed = await db.notification.findMany({ where: { userId: buyer.id, type: "subscription.plan_changed" } });
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0].data, { product: "Aurelia", plan: "Agency" });
    assert.deepEqual((await billing.loadUpgradeOptions(buyer.id, subscription.id))?.options, [], "nothing bigger is left");

    // --- licence installations: only Creem keys of the buyer, and releasing one stores Creem's count
    const creemKey = await db.licenseKey.create({
      data: { entitlementId: subscriptionGrant.id, creemLicenseId: "lic_1", key: "CREEM-KEY", status: "active", activations: 1, activationLimit: 2, mode: "test" },
    });
    assert.equal(await billing.loadLicenseInstances(buyer.id, ownKey.id), null, "our own keys have no Creem installations");
    assert.equal(await billing.loadLicenseInstances("other", creemKey.id), null);
    const loaded = await billing.loadLicenseInstances(buyer.id, creemKey.id);
    assert.deepEqual(loaded?.instances.map((instance) => instance.id), ["ins_1", "ins_2"]);
    assert.equal(await billing.deactivateLicenseInstance(buyer.id, creemKey.id, "ins_2"), false, "already released");
    assert.equal(await billing.deactivateLicenseInstance("other", creemKey.id, "ins_1"), false);
    assert.equal(await billing.deactivateLicenseInstance(buyer.id, creemKey.id, "ins_1"), true);
    assert.deepEqual(calls.at(-1)?.body, { key: "CREEM-KEY", instance_id: "ins_1" });
    assert.equal((await db.licenseKey.findUniqueOrThrow({ where: { id: creemKey.id } })).activations, 0);

    // --- renewals: an ended one-time update window and an ended subscription can be bought again
    const oneTime = await db.price.create({ data: { productId: product.id, name: "Lifetime site", billingType: "onetime", amountCents: 7900, updatesMonths: 12, enabled: true, creemTestProductId: "prod_onetime" } });
    const order = await db.order.create({
      data: { storeId: store.id, customerId: customer.id, productId: product.id, priceId: oneTime.id, creemOrderId: "ord_ada", mode: "test", type: "onetime", status: "paid", amountCents: 7900, currency: "EUR", placedAt: new Date("2024-01-01") },
    });
    const expiredGrant = await db.entitlement.create({ data: { storeId: store.id, customerId: customer.id, productId: product.id, orderId: order.id, updatesUntil: new Date("2025-01-01") } });
    let library = await loadCustomerLibrary(buyer.id, "test");
    assert.equal(library.find((item) => item.id === expiredGrant.id)?.renewPriceId, oneTime.id);
    assert.equal(library.find((item) => item.id === subscriptionGrant.id)?.renewPriceId, null, "a running subscription is not restarted");
    assert.equal(library.find((item) => item.id === subscriptionGrant.id)?.licenses.find((license) => license.id === creemKey.id)?.manageable, true);
    await db.price.update({ where: { id: oneTime.id }, data: { enabled: false } });
    library = await loadCustomerLibrary(buyer.id, "test");
    assert.equal(library.find((item) => item.id === expiredGrant.id)?.renewPriceId, null, "a retired plan cannot be bought again");

    // --- support: thread, turn-taking status, notifications, isolation, daily limit
    const created = await support.createTicket(buyer, store.id, { subject: "Install help", body: "The extension does not appear in TYPO3 13.", productId: product.id });
    assert.equal(created.ok, true);
    const ticketId = created.ok ? created.data.id : "";
    assert.deepEqual(await support.createTicket(buyer, store.id, { subject: "Hi", body: "short" }), { ok: false, reason: "invalid" });
    assert.deepEqual(await support.createTicket(buyer, store.id, { subject: "Not mine", body: "A product the buyer does not own.", productId: "missing" }), { ok: false, reason: "invalid" });
    assert.equal(await support.loadCustomerTicket("other", store.id, ticketId), null);
    assert.deepEqual(await support.replyAsCustomer({ id: "other", name: "Other", email: "other@example.test" }, store.id, ticketId, "Let me in"), { ok: false, reason: "not-found" });

    assert.equal((await support.replyAsStaff("other", store.id, ticketId, "Clear the TYPO3 cache, please.")).ok, true);
    let ticket = await support.loadCustomerTicket(buyer.id, store.id, ticketId);
    assert.equal(ticket?.status, "answered");
    assert.deepEqual(ticket?.messages.map((message) => message.fromStaff), [false, true]);
    const reply = await db.notification.findFirstOrThrow({ where: { userId: buyer.id, type: "support.replied" } });
    assert.equal(reply.href, `/account/support/${ticketId}`);
    assert.equal((reply.data as Record<string, unknown>).subject, "Install help");

    await support.replyAsCustomer(buyer, store.id, ticketId, "That fixed it, thanks.");
    assert.equal((await support.loadCustomerTicket(buyer.id, store.id, ticketId))?.status, "open");
    assert.equal(await support.setTicketStatus(store.id, ticketId, "closed"), true);
    await support.replyAsCustomer(buyer, store.id, ticketId, "One more question.");
    ticket = await support.loadCustomerTicket(buyer.id, store.id, ticketId);
    assert.equal(ticket?.status, "open", "a customer message reopens a closed request");
    assert.equal(await support.openTicketCount(store.id), 1);
    for (let index = 0; index < 4; index++) await support.createTicket(buyer, store.id, { subject: `Question ${index}`, body: "Another question about the product." });
    assert.deepEqual(await support.createTicket(buyer, store.id, { subject: "Sixth", body: "One request too many today." }), { ok: false, reason: "rate-limit" });

    // --- export: everything about the account, no secrets
    await db.account.create({ data: { id: "acc-1", userId: buyer.id, accountId: buyer.id, providerId: "credential", password: "hash-must-not-leak" } });
    await db.session.create({ data: { id: "ses-1", userId: buyer.id, token: "token-must-not-leak", expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130" } });
    await db.newsletterSubscriber.create({ data: { storeId: store.id, email: buyer.email, firstName: "Ada", lastName: "Buyer", confirmedAt: new Date() } });
    const exported = await accountData.exportAccountData(buyer.id);
    const text = JSON.stringify(exported);
    assert.ok(!text.includes("hash-must-not-leak") && !text.includes("token-must-not-leak"), "no password hashes or session tokens");
    assert.equal(exported.account.email, buyer.email);
    assert.equal(exported.purchases[0].orders[0].creemOrderId, "ord_ada");
    assert.equal(exported.supportRequests.length, 5);
    assert.equal(exported.newsletter.length, 1);
    assert.deepEqual(exported.signInMethods.map((method) => method.providerId), ["credential"]);

    // --- deletion: refused while a subscription bills or for staff; afterwards nothing personal remains
    assert.deepEqual(await accountData.deletionBlockers(buyer.id), ["active-subscription"]);
    assert.equal(await accountData.deleteAccount(buyer.id), false);
    await db.subscription.update({ where: { id: subscription.id }, data: { status: "scheduled_cancel" } });
    assert.deepEqual(await accountData.deletionBlockers(buyer.id), [], "a subscription that will not renew does not block");
    await db.storeMember.create({ data: { storeId: store.id, userId: "other", role: "admin" } });
    assert.deepEqual(await accountData.deletionBlockers("other"), ["admin"]);

    assert.equal(await accountData.deleteAccount(buyer.id), true);
    assert.equal(await db.user.findUnique({ where: { id: buyer.id } }), null);
    const kept = await db.customer.findUniqueOrThrow({ where: { id: customer.id } });
    assert.deepEqual({ userId: kept.userId, email: kept.email, name: kept.name }, { userId: null, email: accountData.ANONYMIZED_EMAIL, name: null });
    assert.equal(await db.order.count({ where: { customerId: customer.id } }), 1, "bookkeeping records stay");
    assert.equal(await db.supportTicket.count({ where: { userId: buyer.id } }), 0);
    assert.equal(await db.notification.count({ where: { userId: buyer.id } }), 0);
    assert.equal(await db.session.count({ where: { userId: buyer.id } }), 0);
    assert.equal(await db.newsletterSubscriber.count({ where: { email: buyer.email } }), 0);
  } finally {
    globalDb.prisma = oldDb;
    for (const [key, value] of Object.entries({ CREEM_MODE: previous.mode, CREEM_API_KEY: previous.key, PLUNK_SECRET_KEY: previous.plunk }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
