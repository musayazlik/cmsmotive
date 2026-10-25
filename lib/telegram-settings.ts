import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readStoreValues, upsertStoreValue } from "@/lib/settings-store";
import { listStores } from "@/lib/stores";
import { PAIRING_TTL_MS, type TelegramLink, type TelegramSettings } from "@/lib/telegram-settings-shared";

/**
 * Server-side Telegram bot configuration, kept per store in StoreSetting:
 * every store can connect its own bot, which then works on that store only.
 * Unlike the MCP token, the bot token has to be kept readable (every API call
 * needs it); it is only ever shown masked. Never import this module from a
 * client component.
 */

const KEY = {
  enabled: "telegram.enabled",
  token: "telegram.botToken",
  username: "telegram.botUsername",
  secret: "telegram.webhookSecret",
  origin: "telegram.origin",
  model: "telegram.model",
  contentModel: "telegram.contentModel",
  imageModel: "telegram.imageModel",
  links: "telegram.links",
  pairing: "telegram.pairing",
} as const;

function parseLinks(raw: string | undefined): TelegramLink[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? (value as TelegramLink[]) : [];
  } catch {
    return [];
  }
}

/** Everything the bot runtime needs, including the token. Server only. */
export type TelegramConfig = {
  storeId: string;
  enabled: boolean;
  token: string | null;
  username: string | null;
  webhookSecret: string | null;
  /** Public origin captured when the webhook was registered; links in replies use it. */
  origin: string | null;
  /** Chat model (tool calling); "" = automatic. */
  model: string;
  /** Content and image models for the AI tools; "" = Settings → AI. */
  contentModel: string;
  imageModel: string;
  links: TelegramLink[];
};

export async function getTelegramConfig(storeId: string): Promise<TelegramConfig> {
  const values = await readStoreValues(storeId, Object.values(KEY));
  return {
    storeId,
    enabled: values.get(KEY.enabled) === "true",
    token: values.get(KEY.token) || null,
    username: values.get(KEY.username) || null,
    webhookSecret: values.get(KEY.secret) || null,
    origin: values.get(KEY.origin) || null,
    model: values.get(KEY.model) ?? "",
    contentModel: values.get(KEY.contentModel) ?? "",
    imageModel: values.get(KEY.imageModel) ?? "",
    links: parseLinks(values.get(KEY.links)),
  };
}

/** Every store with a connected, switched-on bot (the long-polling runner serves them all). */
export async function listTelegramBots(): Promise<TelegramConfig[]> {
  const configs = await Promise.all((await listStores()).map((store) => getTelegramConfig(store.id)));
  return configs.filter((config) => config.enabled && config.token);
}

/** The store whose webhook secret Telegram presented, or null. */
export async function findTelegramConfigBySecret(provided: string | null): Promise<TelegramConfig | null> {
  for (const store of await listStores()) {
    const config = await getTelegramConfig(store.id);
    if (isValidWebhookSecret(config, provided)) return config;
  }
  return null;
}

export async function getTelegramSettings(storeId: string): Promise<TelegramSettings> {
  const config = await getTelegramConfig(storeId);
  const users = await prisma.user.findMany({
    where: { id: { in: config.links.map((link) => link.userId) } },
    select: { id: true, email: true },
  });
  const emails = new Map(users.map((user) => [user.id, user.email]));
  return {
    enabled: config.enabled,
    bot: config.token && config.username ? { username: config.username, tokenHint: config.token.slice(-4) } : null,
    model: config.model,
    contentModel: config.contentModel,
    imageModel: config.imageModel,
    links: config.links.map((link) => ({ ...link, userEmail: emails.get(link.userId) ?? null })),
  };
}

/** Stores a verified bot for a store; a fresh webhook secret is issued with it. Returns the secret. */
export async function saveTelegramBot(storeId: string, bot: { token: string; username: string; origin: string }): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  await prisma.$transaction([
    upsertStoreValue(storeId, KEY.token, bot.token),
    upsertStoreValue(storeId, KEY.username, bot.username),
    upsertStoreValue(storeId, KEY.secret, secret),
    upsertStoreValue(storeId, KEY.origin, bot.origin),
    upsertStoreValue(storeId, KEY.enabled, "true"),
  ]);
  return secret;
}

export async function clearTelegramBot(storeId: string): Promise<void> {
  await prisma.storeSetting.deleteMany({
    where: { storeId, key: { in: [KEY.token, KEY.username, KEY.secret, KEY.origin, KEY.pairing] } },
  });
  await upsertStoreValue(storeId, KEY.enabled, "false");
}

export async function saveTelegramOptions(
  storeId: string,
  options: {
    enabled: boolean;
    model: string;
    contentModel: string;
    imageModel: string;
  },
): Promise<void> {
  await prisma.$transaction([
    upsertStoreValue(storeId, KEY.enabled, String(options.enabled)),
    upsertStoreValue(storeId, KEY.model, options.model),
    upsertStoreValue(storeId, KEY.contentModel, options.contentModel),
    upsertStoreValue(storeId, KEY.imageModel, options.imageModel),
  ]);
}

export function isValidWebhookSecret(config: TelegramConfig, provided: string | null): boolean {
  if (!config.webhookSecret || !provided) return false;
  const a = Buffer.from(config.webhookSecret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ pairing */

/** A one-time code the signed-in admin sends to a store's bot to link their Telegram account. */
export async function createPairingCode(storeId: string, userId: string): Promise<string> {
  const code = randomBytes(9).toString("base64url");
  await upsertStoreValue(storeId, KEY.pairing, JSON.stringify({ code, userId, expiresAt: Date.now() + PAIRING_TTL_MS }));
  return code;
}

/** Returns the panel user id the code was issued for, and burns the code. */
export async function consumePairingCode(storeId: string, code: string): Promise<string | null> {
  const raw = (await readStoreValues(storeId, [KEY.pairing])).get(KEY.pairing);
  if (!raw) return null;
  let pairing: { code?: string; userId?: string; expiresAt?: number };
  try {
    pairing = JSON.parse(raw);
  } catch {
    return null;
  }
  const valid =
    typeof pairing.code === "string" &&
    pairing.code.length === code.length &&
    timingSafeEqual(Buffer.from(pairing.code), Buffer.from(code)) &&
    typeof pairing.expiresAt === "number" &&
    pairing.expiresAt > Date.now();
  if (!valid || !pairing.userId) return null;
  await prisma.storeSetting.deleteMany({ where: { storeId, key: KEY.pairing } });
  return pairing.userId;
}

export async function saveTelegramLink(storeId: string, link: TelegramLink): Promise<void> {
  const { links } = await getTelegramConfig(storeId);
  const next = [...links.filter((entry) => entry.telegramUserId !== link.telegramUserId), link];
  await upsertStoreValue(storeId, KEY.links, JSON.stringify(next));
}

export async function removeTelegramLink(storeId: string, telegramUserId: number): Promise<void> {
  const { links } = await getTelegramConfig(storeId);
  await upsertStoreValue(storeId, KEY.links, JSON.stringify(links.filter((entry) => entry.telegramUserId !== telegramUserId)));
}
