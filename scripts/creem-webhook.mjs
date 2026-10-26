import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function listenArguments(env, extra = []) {
  const port = env.PORT || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const mode = env.CREEM_MODE === "live" ? "live" : "test";
  if (!env.CREEM_API_KEY?.trim())
    throw new Error("Set CREEM_API_KEY in .env.local or .env first.");
  if ((mode === "test") !== env.CREEM_API_KEY.startsWith("creem_test_")) {
    throw new Error("CREEM_API_KEY does not match CREEM_MODE.");
  }
  const args = [
    "listen",
    "--environment",
    mode,
    "--forward-to",
    `http://localhost:${port}/api/webhooks/creem`,
  ];
  if (env.CREEM_CLI_WEBHOOK_ID)
    args.push("--webhook", env.CREEM_CLI_WEBHOOK_ID);
  return [...args, ...extra];
}

/** npm's Windows shim cannot be spawned directly; run its JS entry without a shell. */
/** @param {Record<string, string | undefined>} env */
export function cliCommand(env = process.env, platform = process.platform) {
  for (const directory of (env.PATH ?? env.Path ?? "").split(delimiter)) {
    if (!directory) continue;
    if (platform !== "win32") {
      const executable = join(directory, "creem");
      if (existsSync(executable)) return [executable];
      continue;
    }
    const executable = join(directory, "creem.exe");
    if (existsSync(executable)) return [executable];
    const entry = join(
      directory,
      "node_modules",
      "@creem_io",
      "cli",
      "dist",
      "index.js",
    );
    if (existsSync(entry)) return [process.execPath, entry];
  }
  throw new Error(
    "Creem CLI was not found. Install it with npm install -g @creem_io/cli.",
  );
}

function main() {
  // Use Next's environment loader so shell > .env.local > .env, just like the app.
  const require = createRequire(import.meta.url);
  const nextRequire = createRequire(require.resolve("next/package.json"));
  nextRequire("@next/env").loadEnvConfig(
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    true,
  );
  const [command, ...prefix] = cliCommand();
  const args = listenArguments(process.env, process.argv.slice(2));
  const child = spawn(command, [...prefix, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
