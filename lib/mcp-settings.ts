import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MCP_SETTINGS, MCP_TOKEN_PREFIX, type McpSettings } from "@/lib/mcp-settings-shared";

/**
 * Server-side MCP settings, stored in the Setting table next to the upload
 * settings. The HTTP access token is never stored: only its SHA-256 hash and
 * its last characters, so the panel can show it exactly once when it is
 * issued. Never import this module from a client component.
 */

const KEY_HTTP_ENABLED = "mcp.http.enabled";
const KEY_ACTOR = "mcp.actor.userId";
const KEY_TOKEN_HASH = "mcp.token.hash";
const KEY_TOKEN_HINT = "mcp.token.hint";
const KEY_TOKEN_CREATED = "mcp.token.createdAt";
const KEY_TOKEN_USED = "mcp.token.lastUsedAt";
const SETTING_KEYS = [KEY_HTTP_ENABLED, KEY_ACTOR, KEY_TOKEN_HASH, KEY_TOKEN_HINT, KEY_TOKEN_CREATED, KEY_TOKEN_USED];
const TOKEN_KEYS = [KEY_TOKEN_HASH, KEY_TOKEN_HINT, KEY_TOKEN_CREATED, KEY_TOKEN_USED];

/** lastUsedAt is refreshed at most this often, so busy clients do not write on every call. */
const LAST_USED_RESOLUTION_MS = 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest();

async function readValues(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

function upsert(key: string, value: string) {
  return prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function getMcpSettings(): Promise<McpSettings> {
  try {
    const values = await readValues();
    const hash = values.get(KEY_TOKEN_HASH);
    return {
      httpEnabled: values.get(KEY_HTTP_ENABLED) === "true",
      actorUserId: values.get(KEY_ACTOR) || null,
      token: hash
        ? {
            hint: values.get(KEY_TOKEN_HINT) ?? "",
            createdAt: values.get(KEY_TOKEN_CREATED) ?? new Date(0).toISOString(),
            lastUsedAt: values.get(KEY_TOKEN_USED) || null,
          }
        : null,
    };
  } catch {
    return DEFAULT_MCP_SETTINGS;
  }
}

/** The account id MCP acts as, or null to fall back to the oldest admin. */
export async function getMcpActorUserId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_ACTOR } });
  return row?.value || null;
}

export async function saveMcpAccess(settings: { httpEnabled: boolean; actorUserId: string | null }): Promise<void> {
  await prisma.$transaction([
    upsert(KEY_HTTP_ENABLED, String(settings.httpEnabled)),
    upsert(KEY_ACTOR, settings.actorUserId ?? ""),
  ]);
}

/** Issues a new HTTP token, replacing (and so revoking) the previous one. Returns it in plain text. */
export async function issueMcpToken(): Promise<string> {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  await prisma.$transaction([
    upsert(KEY_TOKEN_HASH, hashToken(token).toString("hex")),
    upsert(KEY_TOKEN_HINT, token.slice(-4)),
    upsert(KEY_TOKEN_CREATED, new Date().toISOString()),
    prisma.setting.deleteMany({ where: { key: KEY_TOKEN_USED } }),
  ]);
  return token;
}

export async function revokeMcpToken(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: { in: TOKEN_KEYS } } });
}

export type McpTokenCheck = "disabled" | "no-token" | "invalid" | "ok";

/** Checks a bearer token against the stored hash and records when it was last used. */
export async function verifyMcpToken(provided: string): Promise<McpTokenCheck> {
  const values = await readValues();
  if (values.get(KEY_HTTP_ENABLED) !== "true") return "disabled";

  const stored = values.get(KEY_TOKEN_HASH);
  if (!stored) return "no-token";
  if (!provided) return "invalid";

  const expected = Buffer.from(stored, "hex");
  const actual = hashToken(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "invalid";

  const lastUsed = Date.parse(values.get(KEY_TOKEN_USED) ?? "");
  if (!Number.isFinite(lastUsed) || Date.now() - lastUsed > LAST_USED_RESOLUTION_MS) {
    await upsert(KEY_TOKEN_USED, new Date().toISOString()).catch((error) =>
      console.error("[mcp] could not record token use", error),
    );
  }
  return "ok";
}
