import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
test("registration records current consent, cannot assign privileges, and Google initiation requires consent", async (t) => {
  const schema = `membership_test_${randomUUID().replaceAll("-", "")}`;
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
    "NODE_ENV",
    "CREEM_MODE",
    "NEXT_PUBLIC_SITE_URL",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "PLUNK_SECRET_KEY",
    "PLUNK_FROM_EMAIL",
  ];
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
    Object.assign(process.env, {
      NODE_ENV: "development",
      CREEM_MODE: "test",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "123-fixture.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "fixture-only",
      PLUNK_SECRET_KEY: "fixture-only",
      PLUNK_FROM_EMAIL: "sender@example.test",
    });
    await db.setting.create({
      data: { key: "site.allowSignup", value: "true" },
    });
    const { POST } = await import("../app/api/auth/[...all]/route");
    let mailCount = 0;
    t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(String(input), "https://next-api.useplunk.com/v1/send");
      mailCount++;
      return Response.json({ success: true });
    });
    const call = (path: string, body: Record<string, unknown>) =>
      POST(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": "127.0.0.55",
          },
          body: JSON.stringify(body),
        }),
      );
    const signup = {
      name: "Member Example",
      email: "member@example.test",
      password: "ExamplePassword!2026",
      termsAccepted: true,
      acceptedTermsVersion: "2026-10-24",
      locale: "tr",
      role: "admin",
      accountLocale: "de",
      termsVersion: "forged",
    };
    assert.equal(
      (await call("sign-up/email", { ...signup, termsAccepted: false })).status,
      400,
    );
    assert.equal(await db.user.count(), 0);
    assert.equal(
      (await call("sign-up/email", { ...signup, acceptedTermsVersion: "old" }))
        .status,
      400,
    );
    const created = await call("sign-up/email", signup);
    assert.equal(created.status, 200);
    const user = await db.user.findUniqueOrThrow({
      where: { email: "member@example.test" },
    });
    assert.equal(user.role, "user");
    assert.equal(user.accountLocale, "tr");
    assert.equal(user.termsVersion, "2026-10-24");
    assert.equal(user.privacyVersion, "2026-10-24");
    assert.ok(user.termsAcceptedAt);
    assert.equal(user.emailVerified, false);
    assert.equal(mailCount, 1);
    assert.equal(
      (
        await call("sign-in/social", {
          provider: "google",
          disableRedirect: true,
        })
      ).status,
      400,
    );
    const social = await call("sign-in/social", {
      provider: "google",
      disableRedirect: true,
      callbackURL: "/tr/theme/aurelia-stay",
      additionalData: {
        termsAccepted: true,
        acceptedTermsVersion: "2026-10-24",
        locale: "tr",
        serverContext: { registrationConsent: { termsVersion: "forged" } },
      },
    });
    assert.equal(social.status, 200);
    const url = new URL((await social.json()).url);
    assert.equal(url.hostname, "accounts.google.com");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:3000/api/auth/callback/google",
    );
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(await db.user.count(), 1);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(
      (await call("sign-up/email", { ...signup, email: "public@example.test" }))
        .status,
      400,
    );
    assert.equal(await db.user.count(), 1);
  } finally {
    globalDb.prisma = oldDb;
    for (const key of keys)
      if (previous[key] === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = previous[key];
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
