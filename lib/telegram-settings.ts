import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PAIRING_TTL_MS, type TelegramLink, type TelegramSettings } from "@/lib/telegram-settings-shared";

/**
 * Server-side Telegram bot configuration in the Setting table. Unlike the MCP
 * token, the bot token has to be kept readable (every API call needs it); it
 * is only ever shown masked. Never import this module from a client component.
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

async function read(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEY) } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

function upsert(key: string, value: string) {
  return prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

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

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const values = await read();
  return {
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

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const config = await getTelegramConfig();
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

/** Stores a verified bot; a fresh webhook secret is issued with it. Returns the secret. */
export async function saveTelegramBot(bot: { token: string; username: string; origin: string }): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  await prisma.$transaction([
    upsert(KEY.token, bot.token),
    upsert(KEY.username, bot.username),
    upsert(KEY.secret, secret),
    upsert(KEY.origin, bot.origin),
    upsert(KEY.enabled, "true"),
  ]);
  return secret;
}

export async function clearTelegramBot(): Promise<void> {
  await prisma.setting.deleteMany({
    where: { key: { in: [KEY.token, KEY.username, KEY.secret, KEY.origin, KEY.pairing] } },
  });
  await upsert(KEY.enabled, "false");
}

export async function saveTelegramOptions(options: {
  enabled: boolean;
  model: string;
  contentModel: string;
  imageModel: string;
}): Promise<void> {
  await prisma.$transaction([
    upsert(KEY.enabled, String(options.enabled)),
    upsert(KEY.model, options.model),
    upsert(KEY.contentModel, options.contentModel),
    upsert(KEY.imageModel, options.imageModel),
  ]);
}

export function isValidWebhookSecret(config: TelegramConfig, provided: string | null): boolean {
  if (!config.webhookSecret || !provided) return false;
  const a = Buffer.from(config.webhookSecret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ pairing */

/** A one-time code the signed-in admin sends to the bot to link their Telegram account. */
export async function createPairingCode(userId: string): Promise<string> {
  const code = randomBytes(9).toString("base64url");
  await upsert(KEY.pairing, JSON.stringify({ code, userId, expiresAt: Date.now() + PAIRING_TTL_MS }));
  return code;
}

/** Returns the panel user id the code was issued for, and burns the code. */
export async function consumePairingCode(code: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: KEY.pairing } });
  if (!row) return null;
  let pairing: { code?: string; userId?: string; expiresAt?: number };
  try {
    pairing = JSON.parse(row.value);
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
  await prisma.setting.delete({ where: { key: KEY.pairing } });
  return pairing.userId;
}

export async function saveTelegramLink(link: TelegramLink): Promise<void> {
  const { links } = await getTelegramConfig();
  const next = [...links.filter((entry) => entry.telegramUserId !== link.telegramUserId), link];
  await upsert(KEY.links, JSON.stringify(next));
}

export async function removeTelegramLink(telegramUserId: number): Promise<void> {
  const { links } = await getTelegramConfig();
  await upsert(KEY.links, JSON.stringify(links.filter((entry) => entry.telegramUserId !== telegramUserId)));
}
