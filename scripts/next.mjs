// Next.js cannot read PORT from .env (the HTTP server boots before env files
// load), so resolve it here and pass it to the CLI. Precedence matches Next:
// real environment > .env.local > .env.
// `dev` also stops a previous dev server of this project (.next/dev/lock) and
// anything listening on the port, so it always starts in the current terminal.
import { execSync, spawn } from "node:child_process";
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

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function listeningPids(port) {
  if (process.platform === "win32") {
    return run("netstat -ano -p TCP")
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter(([, local, , state]) => state === "LISTENING" && local?.endsWith(`:${port}`))
      .map((cols) => Number(cols[4]));
  }
  return run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split("\n").map(Number);
}

function killTree(pid) {
  if (!pid || pid === process.pid) return;
  if (process.platform === "win32") {
    run(`taskkill /PID ${pid} /T /F`);
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
  console.log(`Stopped previous process ${pid}`);
}

function stopRunningDevServers(port) {
  const pids = new Set(port ? listeningPids(port) : []);
  if (existsSync(".next/dev/lock")) {
    try {
      pids.add(JSON.parse(readFileSync(".next/dev/lock", "utf8")).pid);
    } catch {}
  }
  for (const pid of pids) killTree(pid);
}

const port = process.env.PORT || portFromEnvFiles();
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

if (process.argv[2] === "dev") stopRunningDevServers(port);

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
