import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

test("activities persist across clients, isolate stores and follow Telegram/MCP lifecycles", async (t) => {
  const schema = `activity_test_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const other = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const previous = globalDb.prisma;
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    await sql.query('CREATE TABLE "Store" ("id" TEXT PRIMARY KEY)');
    await sql.query(await readFile(new URL("../prisma/migrations/20261025210000_assistant_activity/migration.sql", import.meta.url), "utf8"));
    await sql.query('INSERT INTO "Store" ("id") VALUES (\'store-a\'), (\'store-b\')');
    globalDb.prisma = db;
    const { trackActivity, activityStep, currentActivityId, listActivities, cancelActivity, waitingActivityStep } = await import("../lib/assistant-activity");

    await t.test("nested tools are steps, failure results stay failed, and payloads contain no prompts", async () => {
      await trackActivity({ storeId: "store-a", source: "telegram", title: "Telegram assistant" }, async () => {
        const id = currentActivityId();
        await trackActivity({ storeId: "store-a", source: "mcp", title: "Generate a cover" }, async () => {
          assert.equal(currentActivityId(), id);
          await activityStep("Image generation failed.", { failed: true });
        });
      });
      const rows = await other.assistantActivity.findMany();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].source, "telegram");
      assert.equal(rows[0].status, "failed");
      assert.ok(rows[0].finishedAt);
      assert.match(JSON.stringify(rows[0].steps), /Generate a cover/);
    });

    await t.test("waiting Telegram runs resume on the same ID and cancellation cannot cross stores", async () => {
      let id: string | undefined;
      await trackActivity({ storeId: "store-a", source: "telegram", title: "Telegram assistant" }, async () => {
        id = currentActivityId();
        await activityStep("Waiting for confirmation in Telegram.", { status: "waiting" });
      });
      await cancelActivity("store-b", id);
      assert.equal((await db.assistantActivity.findUniqueOrThrow({ where: { id } })).status, "waiting");
      const expiry = (await db.assistantActivity.findUniqueOrThrow({ where: { id } })).expiresAt;
      await waitingActivityStep("store-b", id, "Wrong store");
      assert.notEqual((await db.assistantActivity.findUniqueOrThrow({ where: { id } })).detail, "Wrong store");
      await waitingActivityStep("store-a", id, "Waiting for illustrations.");
      const advanced = await db.assistantActivity.findUniqueOrThrow({ where: { id } });
      assert.equal(advanced.detail, "Waiting for illustrations.");
      assert.equal(advanced.expiresAt.getTime(), expiry.getTime());
      await trackActivity({ storeId: "store-a", source: "telegram", title: "Telegram assistant", resumeId: id }, async () => {
        assert.equal(currentActivityId(), id);
        await activityStep("Publishing the post…");
      });
      assert.equal((await db.assistantActivity.findUniqueOrThrow({ where: { id } })).status, "completed");
      await trackActivity({ storeId: "store-b", source: "telegram", title: "Telegram assistant" }, async () => {
        id = currentActivityId();
        await activityStep("Waiting.", { status: "waiting" });
      });
      await cancelActivity("store-b", id);
      assert.equal((await db.assistantActivity.findUniqueOrThrow({ where: { id } })).status, "cancelled");
      assert.equal((await listActivities("store-a")).some((row) => row.id === id), false);
    });

    await t.test("errors are preserved across a waiting/resume boundary", async () => {
      let id: string | undefined;
      await trackActivity({ storeId: "store-a", source: "telegram", title: "Partial failure" }, async () => {
        id = currentActivityId();
        await activityStep("The cover failed.", { failed: true });
        await activityStep("Waiting for confirmation.", { status: "waiting" });
      });
      await trackActivity({ storeId: "store-a", source: "telegram", title: "Partial failure", resumeId: id }, async () => {
        await activityStep("The draft was saved.");
      });
      assert.equal((await db.assistantActivity.findUniqueOrThrow({ where: { id } })).status, "failed");
    });

    await t.test("thrown errors are safely recorded and rethrown", async () => {
      const failure = new Error("provider secret");
      let id: string | undefined;
      await assert.rejects(trackActivity({ storeId: "store-a", source: "chat", title: "Assistant reply" }, async () => {
        id = currentActivityId();
        throw failure;
      }), (error: unknown) => error === failure);
      const row = await db.assistantActivity.findUniqueOrThrow({ where: { id } });
      assert.equal(row.status, "failed");
      assert.doesNotMatch(JSON.stringify(row), /provider secret/);
    });

    await t.test("the actual MCP transport tracks tools and returned isError results", async () => {
      const { instrumentMcpActivity } = await import("../mcp/activity");
      const { runInStore } = await import("../mcp/context");
      const server = new McpServer({ name: "activity-test", version: "1" });
      instrumentMcpActivity(server);
      server.registerTool("test_tool", { title: "Test tool", inputSchema: { fail: z.boolean() } }, async ({ fail }) => ({
        content: [{ type: "text", text: "private tool output" }], isError: fail,
      }));
      const client = new McpClient({ name: "activity-test-client", version: "1" });
      const [left, right] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(left), client.connect(right)]);
      try {
        await runInStore("store-b", () => client.callTool({ name: "test_tool", arguments: { fail: true } }));
        const rows = await db.assistantActivity.findMany({ where: { storeId: "store-b", source: "mcp" } });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].status, "failed");
        assert.doesNotMatch(JSON.stringify(rows), /private tool output/);
      } finally { await client.close(); await server.close(); }
    });

    await t.test("expired work is reported as expired and active work survives a burst of history", async () => {
      const active = await db.assistantActivity.create({ data: {
        storeId: "store-a", source: "chat", title: "Still running", detail: "Working", expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 10_000),
      } });
      await db.assistantActivity.createMany({ data: Array.from({ length: 25 }, (_, i) => ({
        storeId: "store-a", source: "mcp", title: `Completed ${i}`, detail: "Completed", status: "completed", expiresAt: new Date(),
      })) });
      assert.ok((await listActivities("store-a")).some((row) => row.id === active.id));
      const expired = await db.assistantActivity.create({ data: {
        storeId: "store-a", source: "telegram", title: "Abandoned", detail: "Waiting", status: "waiting", expiresAt: new Date(0),
      } });
      assert.equal((await listActivities("store-a")).find((row) => row.id === expired.id)?.status, "expired");
    });

    await t.test("observability failure never prevents the underlying action", async () => {
      const create = db.assistantActivity.create;
      const log = console.error;
      db.assistantActivity.create = () => { throw new Error("database unavailable"); };
      console.error = () => {};
      try {
        const result = await trackActivity({ storeId: "store-a", source: "chat", title: "Assistant reply" }, async () => {
          await activityStep("Preparing a reply…");
          return "reply still works";
        });
        assert.equal(result, "reply still works");
      } finally { db.assistantActivity.create = create; console.error = log; }
    });
  } finally {
    globalDb.prisma = previous;
    await Promise.all([db.$disconnect(), other.$disconnect()]);
    await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
    await sql.end();
  }
});
