import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cliCommand, listenArguments } from "../scripts/creem-webhook.mjs";

test("local webhooks reach the configured app port and the Creem route using the existing signing endpoint", () => {
  assert.deepEqual(
    listenArguments(
      {
        PORT: "9485",
        CREEM_API_KEY: "creem_test_fixture",
        CREEM_CLI_WEBHOOK_ID: "wh_test_fixture",
      },
      ["--once"],
    ),
    [
      "listen",
      "--environment",
      "test",
      "--forward-to",
      "http://localhost:9485/api/webhooks/creem",
      "--webhook",
      "wh_test_fixture",
      "--once",
    ],
  );
  assert.ok(
    listenArguments({ CREEM_API_KEY: "creem_test_fixture" }).includes(
      "http://localhost:3000/api/webhooks/creem",
    ),
  );
  assert.throws(
    () => listenArguments({ PORT: "0", CREEM_API_KEY: "creem_test_fixture" }),
    /PORT/,
  );
  assert.throws(
    () =>
      listenArguments({
        PORT: "9485/path",
        CREEM_API_KEY: "creem_test_fixture",
      }),
    /PORT/,
  );
  assert.throws(
    () =>
      listenArguments({
        CREEM_MODE: "live",
        CREEM_API_KEY: "creem_test_fixture",
      }),
    /does not match/,
  );
  assert.throws(() => listenArguments({}), /CREEM_API_KEY/);
});

test("Windows launches the installed Creem CLI without interpreting a shell command", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cmsmotive-creem-"));
  try {
    const entry = join(
      directory,
      "node_modules",
      "@creem_io",
      "cli",
      "dist",
      "index.js",
    );
    await mkdir(join(directory, "node_modules", "@creem_io", "cli", "dist"), {
      recursive: true,
    });
    await writeFile(entry, "// CLI fixture");
    assert.deepEqual(cliCommand({ PATH: directory }, "win32"), [
      process.execPath,
      entry,
    ]);
    assert.throws(() => cliCommand({ PATH: "" }, "win32"), /not found/);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "cmsmotive-creem-")));
    await rm(directory, { recursive: true, force: true });
  }
});
