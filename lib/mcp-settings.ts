import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readStoreValues, upsertStoreValue } from "@/lib/settings-store";
import { listStores } from "@/lib/stores";
import {
  DEFAULT_MCP_NAME,
  DEFAULT_MCP_SETTINGS,
  MCP_TOKEN_PREFIX,
  normalizeMcpName,
  type McpSettings,
} from "@/lib/mcp-settings-shared";

/**
 * Server-side MCP settings, kept per store in StoreSetting: each store has
 * its own HTTP switch, acting account and access token, and a token only
 * ever opens its own store. The token is never stored: only its SHA-256 hash
 * and its last characters, so the panel can show it exactly once when it is
 * issued. Never import this module from a client component.
 */

const KEY_NAME = "mcp.name";
const KEY_HTTP_ENABLED = "mcp.http.enabled";
const KEY_ACTOR = "mcp.actor.userId";
const KEY_TOKEN_HASH = "mcp.token.hash";
const KEY_TOKEN_HINT = "mcp.token.hint";
const KEY_TOKEN_CREATED = "mcp.token.createdAt";
const KEY_TOKEN_USED = "mcp.token.lastUsedAt";
const SETTING_KEYS = [
  KEY_NAME,
  KEY_HTTP_ENABLED,
  KEY_ACTOR,
  KEY_TOKEN_HASH,
  KEY_TOKEN_HINT,
  KEY_TOKEN_CREATED,
  KEY_TOKEN_USED,
];
const TOKEN_KEYS = [KEY_TOKEN_HASH, KEY_TOKEN_HINT, KEY_TOKEN_CREATED, KEY_TOKEN_USED];

/** lastUsedAt is refreshed at most this often, so busy clients do not write on every call. */
const LAST_USED_RESOLUTION_MS = 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest();

export async function getMcpSettings(storeId: string): Promise<McpSettings> {
  try {
    const values = await readStoreValues(storeId, SETTING_KEYS);
    const hash = values.get(KEY_TOKEN_HASH);
    return {
      name: normalizeMcpName(values.get(KEY_NAME)) ?? DEFAULT_MCP_NAME,
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

/** The account id MCP acts as in a store, or null to fall back to the oldest admin. */
export async function getMcpActorUserId(storeId: string): Promise<string | null> {
  return (await readStoreValues(storeId, [KEY_ACTOR])).get(KEY_ACTOR) || null;
}

/** The name a store registers with MCP clients; falls back to the default if unset or invalid. */
export async function getMcpServerName(storeId: string): Promise<string> {
  return normalizeMcpName((await readStoreValues(storeId, [KEY_NAME])).get(KEY_NAME)) ?? DEFAULT_MCP_NAME;
}

export async function saveMcpAccess(
  storeId: string,
  settings: {
    name: string;
    httpEnabled: boolean;
    actorUserId: string | null;
  },
): Promise<void> {
  await prisma.$transaction([
    upsertStoreValue(storeId, KEY_NAME, normalizeMcpName(settings.name) ?? DEFAULT_MCP_NAME),
    upsertStoreValue(storeId, KEY_HTTP_ENABLED, String(settings.httpEnabled)),
    upsertStoreValue(storeId, KEY_ACTOR, settings.actorUserId ?? ""),
  ]);
}

/** Issues a new HTTP token for a store, replacing (and so revoking) its previous one. Returns it in plain text. */
export async function issueMcpToken(storeId: string): Promise<string> {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  await prisma.$transaction([
    upsertStoreValue(storeId, KEY_TOKEN_HASH, hashToken(token).toString("hex")),
    upsertStoreValue(storeId, KEY_TOKEN_HINT, token.slice(-4)),
    upsertStoreValue(storeId, KEY_TOKEN_CREATED, new Date().toISOString()),
    prisma.storeSetting.deleteMany({ where: { storeId, key: KEY_TOKEN_USED } }),
  ]);
  return token;
}

export async function revokeMcpToken(storeId: string): Promise<void> {
  await prisma.storeSetting.deleteMany({ where: { storeId, key: { in: TOKEN_KEYS } } });
}

export type McpTokenCheck = { result: "disabled" | "no-token" | "invalid" } | { result: "ok"; storeId: string };

/**
 * Finds the store whose token matches a bearer token and records when it was
 * last used. "disabled" and "no-token" are only reported when no store could
 * accept the token at all, so a client learns why its store is closed.
 */
export async function verifyMcpToken(provided: string): Promise<McpTokenCheck> {
  let enabledStores = 0;
  let issuedTokens = 0;
  for (const store of await listStores()) {
    const values = await readStoreValues(store.id, SETTING_KEYS);
    if (values.get(KEY_HTTP_ENABLED) !== "true") continue;
    enabledStores += 1;
    const stored = values.get(KEY_TOKEN_HASH);
    if (!stored) continue;
    issuedTokens += 1;
    if (!provided) continue;

    const expected = Buffer.from(stored, "hex");
    const actual = hashToken(provided);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) continue;

    const lastUsed = Date.parse(values.get(KEY_TOKEN_USED) ?? "");
    if (!Number.isFinite(lastUsed) || Date.now() - lastUsed > LAST_USED_RESOLUTION_MS) {
      await upsertStoreValue(store.id, KEY_TOKEN_USED, new Date().toISOString()).catch((error) =>
        console.error("[mcp] could not record token use", error),
      );
    }
    return { result: "ok", storeId: store.id };
  }
  if (enabledStores === 0) return { result: "disabled" };
  if (issuedTokens === 0) return { result: "no-token" };
  return { result: "invalid" };
}
