import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("product checkout preserves sign-in intent, redirects to Creem, binds the account, and keeps live release gates", async (t) => {
  const schema = `checkout_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.DATABASE_URL },
      { schema },
    ),
  });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const oldDb = globalDb.prisma;
  const keys = [
    "CREEM_MODE",
    "CREEM_API_KEY",
    "CREEM_WEBHOOK_SECRET",
    "NEXT_PUBLIC_SITE_URL",
    "BETTER_AUTH_URL",
  ] as const;
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
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
    process.env.CREEM_WEBHOOK_SECRET = "fixture";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    const { auth } = await import("../lib/auth");
    const { POST } = await import("../app/api/billing/checkout/route");
    const user = await db.user.create({
      data: {
        id: "buyer",
        name: "Checkout Buyer",
        email: "buyer@example.test",
        emailVerified: true,
      },
    });
    // The store_scoped_content migration leaves a default store in an empty database.
    const store = await db.store.findFirstOrThrow();
    // The products_and_commerce migration seeds the theme/extension product types.
    const type = await db.productType.findUniqueOrThrow({ where: { key: "theme" } });
    const product = await db.product.create({
      data: {
        storeId: store.id,
        typeId: type.id,
        name: "Sample",
        slug: "sample",
        summary: "Sample theme",
        description: "Concept only",
        status: "concept",
        listings: { create: { storeId: store.id, position: 10 } },
      },
    });
    const price = await db.price.create({
      data: {
        productId: product.id,
        storeId: store.id,
        name: "Annual",
        billingType: "recurring",
        interval: "year",
        amountCents: 14900,
        creemTestProductId: "prod_fixture",
        enabled: true,
      },
    });
    let signedIn = false;
    let verified = true;
    t.mock.method(auth.api, "getSession", async () =>
      signedIn ? { user: { ...user, emailVerified: verified } } : null,
    );
    let remotePrice = 14900;
    let redirect = "https://www.creem.io/test/payment/checkout_fixture";
    let checkoutBody: Record<string, unknown> | undefined;
    t.mock.method(
      globalThis,
      "fetch",
      async (url: RequestInfo | URL, options?: RequestInit) => {
        assert.ok(String(url).startsWith("https://test-api.creem.io/"));
        if (String(url).includes("/v1/products/"))
          return Response.json({
            id: "prod_fixture",
            price: remotePrice,
            currency: "EUR",
            billing_type: "recurring",
            billing_period: "every-year",
            tax_mode: "inclusive",
            status: "active",
          });
        assert.equal(String(url), "https://test-api.creem.io/v1/checkouts");
        checkoutBody = JSON.parse(String(options?.body));
        return Response.json({ checkout_url: redirect });
      },
    );
    const send = (
      options: {
        origin?: string;
        terms?: string;
        accept?: string;
        next?: string;
      } = {},
    ) => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        priceId: price.id,
        terms: options.terms ?? "on",
        renewal: "on",
        termsVersion: "2026-10-24",
        lang: "tr",
        returnPath: options.next ?? `/tr/theme/sample?plan=${price.id}`,
      }))
        form.set(k, v);
      return POST(
        new Request("http://localhost:3000/api/billing/checkout", {
          method: "POST",
          headers: {
            origin: options.origin ?? "http://localhost:3000",
            accept: options.accept ?? "application/json",
          },
          body: form,
        }),
      );
    };
    assert.equal((await send({ origin: "https://evil.test" })).status, 403);
    const guest = await send();
    assert.equal(guest.status, 401);
    const login = new URL(
      (await guest.json()).loginUrl,
      "http://localhost:3000",
    );
    assert.equal(login.pathname, "/auth/sign-in");
    assert.equal(
      login.searchParams.get("next"),
      `/tr/theme/sample?plan=${price.id}`,
    );
    signedIn = true;
    verified = false;
    assert.equal((await send()).status, 401);
    verified = true;
    assert.equal((await send({ terms: "off" })).status, 400);
    const result = await send();
    assert.equal(result.status, 200);
    assert.equal((await result.json()).url, redirect);
    const attempt = await db.checkoutAttempt.findFirstOrThrow();
    assert.equal(attempt.userId, user.id);
    assert.equal(attempt.priceId, price.id);
    assert.equal(attempt.storeId, store.id);
    assert.equal(attempt.mode, "test");
    assert.equal(attempt.termsVersion, "2026-10-24");
    assert.equal(checkoutBody?.request_id, attempt.id);
    assert.deepEqual(checkoutBody?.customer, { email: user.email });
    assert.equal(await db.subscription.count(), 0);
    remotePrice = 999;
    assert.equal((await send()).status, 409);
    remotePrice = 14900;
    const formResponse = await send({ accept: "text/html" });
    assert.equal(formResponse.status, 303);
    assert.equal(formResponse.headers.get("location"), redirect);
    redirect = "https://evil.test/payment";
    assert.equal((await send()).status, 502);
    process.env.CREEM_MODE = "live";
    process.env.CREEM_API_KEY = "creem_live_fixture";
    assert.equal((await send()).status, 503);
  } finally {
    globalDb.prisma = oldDb;
    for (const key of keys)
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
