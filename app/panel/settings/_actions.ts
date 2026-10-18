"use server";

import { revalidatePath } from "next/cache";
import { isAdminRole, requireAdmin } from "@/lib/admin-guard";
import { issueMcpToken, revokeMcpToken, saveMcpAccess } from "@/lib/mcp-settings";
import { prisma } from "@/lib/prisma";
import { validateAiSettings } from "@/lib/ai-settings-shared";
import { validateEmailSettings } from "@/lib/email-settings-shared";
import { isPlunkConfigured, sendTestEmail } from "@/lib/plunk";
import { validateReviewSettings } from "@/lib/review-settings-shared";
import {
  saveAiSettings,
  saveEmailSettings,
  saveReviewSettings,
  saveSeoSettings,
  saveSiteSettings,
  saveUploadSettings,
} from "@/lib/settings";
import { siteOrigin } from "@/lib/seo";
import { validateSeoSettings } from "@/lib/seo-settings-shared";
import { validateSiteSettings } from "@/lib/site-settings-shared";
import {
  clearTelegramBot,
  createPairingCode,
  getTelegramConfig,
  removeTelegramLink,
  saveTelegramBot,
  saveTelegramOptions,
} from "@/lib/telegram-settings";
import { getMe, telegram } from "@/telegram/api";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN } from "@/lib/upload-settings-shared";
import type { ActionResult } from "@/app/panel/media/_lib";

const FORBIDDEN = "You are not allowed to perform this action.";

/** Shared body of the JSON-group save actions: admin check, validation, write. */
async function saveGroup<T>(
  name: string,
  input: Record<string, unknown>,
  validate: (input: Record<string, unknown>) => { error: string } | { data: T },
  save: (data: T) => Promise<void>,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const parsed = validate(input ?? {});
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    await save(parsed.data);
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error(`save ${name} settings failed`, error);
    return { ok: false, error: "The settings could not be saved." };
  }
}

export async function saveSiteSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("site", input, validateSiteSettings, saveSiteSettings);
}

export async function saveSeoSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("seo", input, validateSeoSettings, saveSeoSettings);
}

export async function saveReviewSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("review", input, validateReviewSettings, saveReviewSettings);
}

export async function saveEmailSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("email", input, validateEmailSettings, saveEmailSettings);
}

export async function saveAiSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("ai", input, validateAiSettings, saveAiSettings);
}

/** Sends a test message to the contact inbox with the saved e-mail settings. */
export async function sendTestEmailAction(): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };
  if (!isPlunkConfigured()) return { ok: false, error: "Set PLUNK_SECRET_KEY and PLUNK_FROM_EMAIL first." };

  try {
    return { ok: true, to: await sendTestEmail() };
  } catch (error) {
    console.error("sendTestEmailAction failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "The test e-mail could not be sent." };
  }
}

/**
 * Persists the upload-optimization settings. Re-checked against the admin
 * role because server actions are reachable endpoints, unlike the page
 * layout guard.
 */
export async function saveUploadSettingsAction(
  convertWebp: boolean,
  webpQuality: number,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  if (!Number.isInteger(webpQuality) || webpQuality < WEBP_QUALITY_MIN || webpQuality > WEBP_QUALITY_MAX) {
    return { ok: false, error: `Quality must be between ${WEBP_QUALITY_MIN} and ${WEBP_QUALITY_MAX}.` };
  }

  try {
    await saveUploadSettings({ convertWebp, webpQuality });
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("saveUploadSettingsAction failed", error);
    return { ok: false, error: "The settings could not be saved." };
  }
}

/** Turns the HTTP endpoint on or off and picks the admin account MCP acts as (null = oldest admin). */
export async function saveMcpAccessAction(httpEnabled: boolean, actorUserId: string | null): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  if (actorUserId) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
    if (!user) return { ok: false, error: "The selected account no longer exists." };
    if (!isAdminRole(user.role)) return { ok: false, error: "MCP can only act as an admin or superadmin account." };
  }

  try {
    await saveMcpAccess({ httpEnabled, actorUserId });
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("saveMcpAccessAction failed", error);
    return { ok: false, error: "The MCP settings could not be saved." };
  }
}

/** Issues a new HTTP access token; the previous one stops working immediately. */
export async function issueMcpTokenAction(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  try {
    const token = await issueMcpToken();
    revalidatePath("/panel/settings");
    return { ok: true, token };
  } catch (error) {
    console.error("issueMcpTokenAction failed", error);
    return { ok: false, error: "A new token could not be created." };
  }
}

export async function revokeMcpTokenAction(): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  try {
    await revokeMcpToken();
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("revokeMcpTokenAction failed", error);
    return { ok: false, error: "The token could not be revoked." };
  }
}

/* ---------------------------------------------------------------- Telegram */

/**
 * Verifies a bot token with getMe, stores it and registers the webhook.
 * Telegram only calls HTTPS webhooks, so on a plain-http origin (local
 * development) the bot is saved without one and `pnpm telegram:poll` serves it.
 */
export async function connectTelegramBotAction(
  token: string,
): Promise<{ ok: true; username: string; webhook: boolean } | { ok: false; error: string }> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const trimmed = token.trim();
  if (!/^\d+:[\w-]{30,}$/.test(trimmed)) return { ok: false, error: "That does not look like a bot token from @BotFather." };

  try {
    const bot = await getMe(trimmed);
    const origin = await siteOrigin();
    const secret = await saveTelegramBot({ token: trimmed, username: bot.username ?? String(bot.id), origin });
    const webhook = origin.startsWith("https://");
    if (webhook) {
      await telegram(trimmed, "setWebhook", {
        url: `${origin}/api/telegram/webhook`,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
    }
    await telegram(trimmed, "setMyCommands", {
      commands: [
        { command: "new", description: "Start a fresh conversation" },
        { command: "whoami", description: "Panel account the bot acts as" },
        { command: "help", description: "What the bot can do" },
      ],
    }).catch(() => undefined);
    revalidatePath("/panel/settings");
    return { ok: true, username: bot.username ?? String(bot.id), webhook };
  } catch (error) {
    console.error("connectTelegramBotAction failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "The bot could not be connected." };
  }
}

export async function disconnectTelegramBotAction(): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  try {
    const { token } = await getTelegramConfig();
    if (token) await telegram(token, "deleteWebhook").catch(() => undefined);
    await clearTelegramBot();
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("disconnectTelegramBotAction failed", error);
    return { ok: false, error: "The bot could not be disconnected." };
  }
}

export async function saveTelegramOptionsAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const modelId = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
  const [model, contentModel, imageModel] = [modelId("model"), modelId("contentModel"), modelId("imageModel")];
  const valid = [model, contentModel, imageModel].every((id) => !id || /^[\w.:/-]{1,120}$/.test(id));
  if (typeof input.enabled !== "boolean" || !valid) {
    return { ok: false, error: "Invalid Telegram settings." };
  }
  try {
    await saveTelegramOptions({ enabled: input.enabled, model, contentModel, imageModel });
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("saveTelegramOptionsAction failed", error);
    return { ok: false, error: "The settings could not be saved." };
  }
}

/** A deep link that links the signed-in admin's Telegram account when opened. */
export async function createTelegramPairingAction(): Promise<{ ok: true; url: string; code: string } | { ok: false; error: string }> {
  const { session, failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const { username } = await getTelegramConfig();
  if (!username) return { ok: false, error: "Connect a bot first." };
  const code = await createPairingCode(session.user.id);
  return { ok: true, code, url: `https://t.me/${username}?start=${code}` };
}

export async function removeTelegramLinkAction(telegramUserId: number): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };
  if (!Number.isSafeInteger(telegramUserId)) return { ok: false, error: "Invalid account." };

  await removeTelegramLink(telegramUserId);
  revalidatePath("/panel/settings");
  return { ok: true };
}
