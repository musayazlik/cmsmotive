// Next.js cannot read PORT from .env (the HTTP server boots before env files
// load), so resolve it here and pass it to the CLI. Precedence matches Next:
// real environment > .env.local > .env.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

function portFromEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const port = parseEnv(readFileSync(file, "utf8")).PORT;
    if (port) return port;
  }
}

const port = process.env.PORT || portFromEnvFiles();
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: port ? { ...process.env, PORT: port } : process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
