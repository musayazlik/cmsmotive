import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("signed payment events reconcile idempotently, preserve scheduled cancellation and reject cross-environment access", async (t) => {
  const schema = `commerce_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.DATABASE_URL },
      { schema },
    ),
  });
  const previous = {
    mode: process.env.CREEM_MODE,
    key: process.env.CREEM_API_KEY,
    secret: process.env.CREEM_WEBHOOK_SECRET,
  };
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const oldDb = globalDb.prisma;
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    for (const dir of (
      await readdir(new URL("../prisma/migrations/", import.meta.url), {
        withFileTypes: true,
      })
    )
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      await sql.query(
        (
          await readFile(
            new URL(
              `../prisma/migrations/${dir.name}/migration.sql`,
              import.meta.url,
            ),
            "utf8",
          )
        ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ""),
      );
    globalDb.prisma = db;
    process.env.CREEM_MODE = "test";
    process.env.CREEM_API_KEY = "creem_test_fixture";
    process.env.CREEM_WEBHOOK_SECRET = "fixture-webhook-secret";
    const { POST } = await import("../app/api/webhooks/creem/route");
    await db.user.create({
      data: {
        id: "buyer",
        name: "Test buyer",
        email: "buyer@example.com",
        emailVerified: true,
      },
    });
    const plan = await db.billingPlan.create({
      data: {
        kind: "theme",
        productSlug: "fixture",
        name: "Annual",
        priceCents: 26900,
      },
    });
    const attempt = await db.checkoutAttempt.create({
      data: {
        userId: "buyer",
        planId: plan.id,
        mode: "test",
        creemProductId: "prod_fixture",
        termsVersion: "1",
        privacyVersion: "1",
      },
    });
    let canonical = {
      id: "sub_fixture",
      product: "prod_fixture",
      customer: "cust_fixture",
      mode: "test",
      status: "active",
      last_transaction_id: "tran_fixture",
      current_period_start_date: "2026-01-01T00:00:00Z",
      current_period_end_date: "2027-01-01T00:00:00Z",
      updated_at: "2026-10-24T10:00:00Z",
      metadata: { checkoutAttemptId: attempt.id },
    };
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return Response.json(canonical);
    });
    const send = async (
      id: string,
      type = "subscription.paid",
      signature = true,
      object: Record<string, unknown> = { id: "sub_fixture" },
    ) => {
      const raw = JSON.stringify({
        id,
        eventType: type,
        created_at: Date.now(),
        object,
      });
      return POST(
        new Request("http://localhost/api/webhooks/creem", {
          method: "POST",
          headers: {
            "creem-signature": signature
              ? createHmac("sha256", process.env.CREEM_WEBHOOK_SECRET!)
                  .update(raw)
                  .digest("hex")
              : "bad",
          },
          body: raw,
        }),
      );
    };
    assert.equal(
      (await send("invalid", "subscription.paid", false)).status,
      401,
    );
    assert.equal(await db.productSubscription.count(), 0);
    assert.equal((await send("paid")).status, 200);
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).userId,
      "buyer",
    );
    const count = calls;
    assert.equal((await send("paid")).status, 200);
    assert.equal(calls, count);
    assert.equal(await db.productSubscription.count(), 1);
    canonical = {
      ...canonical,
      status: "scheduled_cancel",
      updated_at: "2026-10-24T11:00:00Z",
    };
    assert.equal(
      (await send("scheduled", "subscription.scheduled_cancel")).status,
      200,
    );
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "scheduled_cancel",
    );
    canonical = {
      ...canonical,
      status: "canceled",
      updated_at: "2026-10-24T12:00:00Z",
    };
    assert.equal((await send("canceled", "subscription.canceled")).status, 200);
    assert.equal(
      (await send("late-active", "subscription.active")).status,
      200,
    );
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "canceled",
    );
    assert.equal(
      (
        await send("refund", "refund.created", true, {
          id: "ref_fixture",
          subscription: "sub_fixture",
          transaction: { id: "tran_fixture", status: "refunded" },
        })
      ).status,
      200,
    );
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "refunded",
    );
    await send("late-after-refund");
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "refunded",
    );
    canonical = {
      ...canonical,
      status: "active",
      last_transaction_id: "tran_renewal",
      updated_at: "2026-10-24T13:00:00Z",
    };
    await send("new-renewal");
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "active",
    );
    await send("old-refund", "refund.created", true, {
      subscription: "sub_fixture",
      transaction: { id: "tran_fixture", status: "refunded" },
    });
    assert.equal(
      (await db.productSubscription.findFirstOrThrow()).status,
      "active",
    );
    canonical = { ...canonical, mode: "prod" };
    assert.equal((await send("wrong-mode")).status, 400);
    assert.equal(
      await db.paymentEvent.count({ where: { id: "wrong-mode" } }),
      0,
    );
  } finally {
    globalDb.prisma = oldDb;
    for (const [key, value] of Object.entries({
      CREEM_MODE: previous.mode,
      CREEM_API_KEY: previous.key,
      CREEM_WEBHOOK_SECRET: previous.secret,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
