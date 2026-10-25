import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

test("store membership isolates permissions and transfers authenticated sessions across domains", async (t) => {
  const environment: Record<string, string | undefined> = process.env;
  const oldEnvironment = environment.NODE_ENV;
  environment.NODE_ENV = "development";
  const schema = `store_access_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const previous = globalDb.prisma;
  const migrationName = "20261025220000_store_members";
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    const migrations = (await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const migration of migrations.filter((entry) => entry.name !== migrationName)) {
      const source = await readFile(new URL(`../prisma/migrations/${migration.name}/migration.sql`, import.meta.url), "utf8");
      await sql.query(source.replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
    }
    await db.store.updateMany({ data: { isDefault: false } });
    for (const key of ["alpha", "beta", "gamma"]) await db.store.create({ data: {
      id: key, key, name: key, isDefault: key === "alpha", domains: { create: { host: `${key}.example`, primary: true } },
    } });
    await db.user.createMany({ data: [
      { id: "legacy-admin", name: "Legacy Admin", email: "legacy@example.test", role: "admin", emailVerified: true },
      { id: "tenant-admin", name: "Tenant Admin", email: "tenant@example.test", role: "user", emailVerified: true },
      { id: "owner", name: "Owner", email: "owner@example.test", role: "superadmin", emailVerified: true },
      { id: "member", name: "Member", email: "member@example.test", role: "user", emailVerified: true },
    ] });
    await sql.query(await readFile(new URL(`../prisma/migrations/${migrationName}/migration.sql`, import.meta.url), "utf8"));
    globalDb.prisma = db;
    const { getStoreRole, accessibleStores } = await import("../lib/store-access");
    const { addStoreUser, listStoreUsers, getStoreUser, updateStoreUser, removeStoreUser } = await import("../lib/store-users");
    const { issueStoreSessionTransfer, completeStoreSessionTransfer } = await import("../lib/store-session-transfer");
    const { auth } = await import("../lib/auth");
    const require = createRequire(import.meta.url);
    const dependency = createRequire(require.resolve("better-auth"));
    const { serializeSignedCookie } = dependency("better-call");
    const context = await auth.$context;
    const sourceOrigin = "http://alpha.localhost:9485";
    const targetOrigin = "http://beta.localhost:9485";
    const sourceHeaders = async () => {
      const token = randomUUID();
      const session = await db.session.create({ data: { id: randomUUID(), token, userId: "tenant-admin", expiresAt: new Date(Date.now() + 20 * 60_000) } });
      const signed = (await serializeSignedCookie(context.authCookies.sessionToken.name, token, context.secret, { path: "/", httpOnly: true })).split(";")[0];
      return { session, headers: new Headers({ host: "alpha.localhost:9485", origin: sourceOrigin, cookie: signed, "x-forwarded-proto": "http" }) };
    };
    const targetRequest = (origin = targetOrigin, from = sourceOrigin) => new Request(`${origin}/api/admin/store-session`, { method: "POST", headers: { origin: from, "content-type": "application/x-www-form-urlencoded" } });
    const grantId = (token: string) => `store-switch:${createHash("sha256").update(token).digest("hex")}`;

    await t.test("migration preserves legacy administrators and associates ordinary registrations with the default store", async () => {
      assert.equal(await getStoreRole("legacy-admin", "beta"), "admin");
      assert.equal(await getStoreRole("member", "alpha"), "user");
      assert.equal(await getStoreRole("member", "beta"), null);
      assert.equal(await getStoreRole("owner", "gamma"), "superadmin");
      await db.user.create({ data: { id: "unassigned-admin", name: "Unassigned", email: "unassigned@example.test", role: "admin" } });
      assert.equal(await getStoreRole("unassigned-admin", "beta"), null);
      await db.storeMember.update({ where: { storeId_userId: { storeId: "alpha", userId: "tenant-admin" } }, data: { role: "admin" } });
      await db.storeMember.create({ data: { storeId: "beta", userId: "tenant-admin", role: "admin" } });
      assert.deepEqual((await accessibleStores("tenant-admin")).map((store) => store.id).sort(), ["alpha", "beta"]);
    });

    await t.test("store users can share an identity while their roles and removals remain independent", async () => {
      const user = await addStoreUser("beta", "tenant-admin", { name: "Shared", email: "shared@example.test", role: "admin" });
      const linked = await addStoreUser("alpha", "tenant-admin", { name: "Do not overwrite", email: "shared@example.test", role: "user" });
      assert.equal(linked.id, user.id);
      assert.equal(linked.name, "Shared");
      assert.equal(linked.role, "user");
      assert.equal(await getStoreRole(user.id, "beta"), "admin");
      await assert.rejects(updateStoreUser("alpha", "tenant-admin", user.id, { name: "Take over" }), /multiple stores/);
      await assert.rejects(addStoreUser("gamma", "tenant-admin", { name: "Other", email: "other@example.test", role: "admin" }), /cannot manage/);
      const privateUser = await addStoreUser("beta", "tenant-admin", { name: "Beta only", email: "beta-only@example.test", role: "user" });
      await assert.rejects(getStoreUser("alpha", "tenant-admin", privateUser.id), /not found/);
      assert.equal((await listStoreUsers("alpha", "tenant-admin")).users.some((row) => row.id === privateUser.id), false);
      await updateStoreUser("alpha", "tenant-admin", user.id, { role: "admin" });
      await removeStoreUser("alpha", "tenant-admin", user.id);
      assert.equal(await getStoreRole(user.id, "alpha"), null);
      assert.equal(await getStoreRole(user.id, "beta"), "admin");
      assert.ok(await db.user.findUnique({ where: { id: user.id } }));
      await assert.rejects(updateStoreUser("alpha", "tenant-admin", "tenant-admin", { role: "user" }), /own admin/);
    });

    await t.test("a source-only session becomes a valid target-domain cookie without credentials", async () => {
      const { headers, session } = await sourceHeaders();
      const transfer = await issueStoreSessionTransfer(headers, "beta", `${targetOrigin}/panel`);
      assert.ok(transfer);
      assert.notEqual(transfer.token, session.token);
      const response = await completeStoreSessionTransfer(targetRequest(), transfer.token);
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), `${targetOrigin}/panel`);
      const cookies = response.headers.getSetCookie();
      assert.ok(cookies.some((cookie) => cookie.startsWith(`${context.authCookies.sessionToken.name}=`)));
      const targetHeaders = new Headers({ host: "beta.localhost:9485", cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") });
      assert.equal((await auth.api.getSession({ headers: targetHeaders }))?.user.id, "tenant-admin");
      assert.equal((await completeStoreSessionTransfer(targetRequest(), transfer.token)).status, 403);
    });

    await t.test("MCP and Telegram actors use current store permissions rather than global roles", async () => {
      const { runInStore, runAsActor, resolveMcpActor } = await import("../mcp/context");
      const actor = await runInStore("alpha", () => runAsActor("tenant-admin", resolveMcpActor));
      assert.equal(actor.role, "admin");
      await assert.rejects(runInStore("gamma", () => runAsActor("tenant-admin", resolveMcpActor)), /not an admin/);
      await db.storeMember.update({ where: { storeId_userId: { storeId: "alpha", userId: "tenant-admin" } }, data: { role: "user" } });
      await assert.rejects(runInStore("alpha", () => runAsActor("tenant-admin", resolveMcpActor)), /not an admin/);
      await db.storeMember.update({ where: { storeId_userId: { storeId: "alpha", userId: "tenant-admin" } }, data: { role: "admin" } });
    });

    await t.test("the handoff is bound to its target domain and source origin", async () => {
      const transfer = await issueStoreSessionTransfer((await sourceHeaders()).headers, "beta", `${targetOrigin}/panel`);
      assert.ok(transfer);
      assert.equal((await completeStoreSessionTransfer(targetRequest("http://gamma.localhost:9485"), transfer.token)).status, 403);
      assert.equal((await completeStoreSessionTransfer(targetRequest(targetOrigin, "https://attacker.example"), transfer.token)).status, 403);
      assert.equal((await completeStoreSessionTransfer(targetRequest(targetOrigin, "null"), transfer.token)).status, 403);
      assert.equal((await completeStoreSessionTransfer(targetRequest(), transfer.token)).status, 303);
    });

    await t.test("expired codes, revoked sessions and memberships cannot establish target sessions", async () => {
      const expired = await issueStoreSessionTransfer((await sourceHeaders()).headers, "beta", `${targetOrigin}/panel`);
      assert.ok(expired);
      await db.verification.updateMany({ where: { identifier: grantId(expired.token) }, data: { expiresAt: new Date(0) } });
      assert.equal((await completeStoreSessionTransfer(targetRequest(), expired.token)).status, 403);
      const revokedSource = await sourceHeaders();
      const revoked = await issueStoreSessionTransfer(revokedSource.headers, "beta", `${targetOrigin}/panel`);
      assert.ok(revoked);
      await db.session.delete({ where: { id: revokedSource.session.id } });
      const revokedResponse = await completeStoreSessionTransfer(targetRequest(), revoked.token);
      assert.equal(revokedResponse.status, 403);
      assert.equal(revokedResponse.headers.getSetCookie().length, 0);
      const access = await issueStoreSessionTransfer((await sourceHeaders()).headers, "beta", `${targetOrigin}/panel`);
      assert.ok(access);
      await db.storeMember.delete({ where: { storeId_userId: { storeId: "beta", userId: "tenant-admin" } } });
      assert.equal((await completeStoreSessionTransfer(targetRequest(), access.token)).status, 403);
      assert.equal(await issueStoreSessionTransfer((await sourceHeaders()).headers, "gamma", "http://gamma.localhost:9485/panel"), null);
      await db.storeMember.create({ data: { storeId: "beta", userId: "tenant-admin", role: "admin" } });
    });

    await t.test("simultaneous redemption succeeds once and standard members keep a customer session", async () => {
      const transfer = await issueStoreSessionTransfer((await sourceHeaders()).headers, "beta", `${targetOrigin}/panel`);
      assert.ok(transfer);
      const responses = await Promise.all([completeStoreSessionTransfer(targetRequest(), transfer.token), completeStoreSessionTransfer(targetRequest(), transfer.token)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [303, 403]);
      await db.storeMember.update({ where: { storeId_userId: { storeId: "beta", userId: "tenant-admin" } }, data: { role: "user" } });
      const customer = await issueStoreSessionTransfer((await sourceHeaders()).headers, "beta", `${targetOrigin}/panel`);
      assert.ok(customer);
      const response = await completeStoreSessionTransfer(targetRequest(), customer.token);
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), `${targetOrigin}/account`);
    });
  } finally {
    globalDb.prisma = previous;
    if (oldEnvironment === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = oldEnvironment;
    await db.$disconnect();
    await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
    await sql.end();
  }
});
