"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { saveAdminAccessSettings } from "@/lib/admin-access";
import { validateAdminAccessSettings } from "@/lib/admin-access-shared";
import { adminEntryConfigured } from "@/lib/admin-entry";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-guard";
import { getStoreRole, isStoreAdmin } from "@/lib/store-access";
import { issueMcpToken, revokeMcpToken, saveMcpAccess } from "@/lib/mcp-settings";
import { MCP_NAME_ERROR, normalizeMcpName } from "@/lib/mcp-settings-shared";
import { prisma } from "@/lib/prisma";
import { validateAiSettings } from "@/lib/ai-settings-shared";
import { validateEmailSettings } from "@/lib/email-settings-shared";
import { isPlunkConfigured, sendTestEmail } from "@/lib/plunk";
import { validateMaintenanceSettings } from "@/lib/maintenance-settings-shared";
import { validateReviewSettings } from "@/lib/review-settings-shared";
import {
  saveAiSettings,
  saveEmailSettings,
  saveMaintenanceSettings,
  saveReviewSettings,
  saveSeoSettings,
  saveSiteSettings,
  saveUploadSettings,
} from "@/lib/settings";
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
import { BOT_COMMANDS } from "@/telegram/modes";
import { validateUploadSettings } from "@/lib/upload-settings-shared";
import type { ActionResult } from "@/app/panel/media/_lib";
import { saveLegalSettings } from "@/lib/legal";
import { validateLegalSettings } from "@/lib/legal-settings-shared";
import { panelStore, panelStoreOrigin } from "@/lib/panel-store";

const FORBIDDEN = "You are not allowed to perform this action.";

export async function saveAdminAccessSettingsAction(input: Record<string, unknown>): Promise<{ ok: true; panelPath: string } | { ok: false; error: string }> {
  const { failure } = await requireSuperAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };
  const parsed = validateAdminAccessSettings(input ?? {});
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (parsed.data.panelPath !== "/panel" && !adminEntryConfigured()) {
    return { ok: false, error: "Set a stable BETTER_AUTH_SECRET of at least 32 characters before enabling a private address." };
  }
  if (typeof input.currentPassword !== "string" || !input.currentPassword || input.currentPassword.length > 128) {
    return { ok: false, error: "Confirm your current password to change the panel address." };
  }
  try {
    await auth.api.verifyPassword({ body: { password: input.currentPassword }, headers: await headers() });
  } catch {
    return { ok: false, error: "Your password could not be verified. Sign in again or check your current password." };
  }
  try {
    await saveAdminAccessSettings(parsed.data);
    revalidatePath("/panel", "layout");
    return { ok: true, panelPath: parsed.data.panelPath };
  } catch {
    return { ok: false, error: "The panel address could not be saved." };
  }
}

/** Shared body of the JSON-group save actions: admin check, validation, write to the panel's store. */
async function saveGroup<T>(
  name: string,
  input: Record<string, unknown>,
  validate: (input: Record<string, unknown>) => { error: string } | { data: T },
  save: (storeId: string, data: T) => Promise<void>,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const parsed = validate(input ?? {});
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    await save((await panelStore()).id, parsed.data);
    revalidatePath("/panel/settings", "layout");
    return { ok: true };
  } catch (error) {
    console.error(`save ${name} settings failed`, error);
    return { ok: false, error: "The settings could not be saved." };
  }
}

export async function saveSiteSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("site", input, validateSiteSettings, saveSiteSettings);
}

export async function saveLegalSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  const result = await saveGroup("legal", input, validateLegalSettings, saveLegalSettings);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveSeoSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("seo", input, validateSeoSettings, saveSeoSettings);
}

export async function saveMaintenanceSettingsAction(input: Record<string, unknown>): Promise<ActionResult> {
  return saveGroup("maintenance", input, validateMaintenanceSettings, saveMaintenanceSettings);
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
    return { ok: true, to: await sendTestEmail((await panelStore()).id) };
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
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const parsed = validateUploadSettings(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    await saveUploadSettings((await panelStore()).id, parsed.data);
    revalidatePath("/panel", "layout");
    return { ok: true };
  } catch (error) {
    console.error("saveUploadSettingsAction failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "The settings could not be saved." };
  }
}

/** Turns the HTTP endpoint on or off, picks the server name and the admin account MCP acts as (null = oldest admin). */
export async function saveMcpAccessAction(
  httpEnabled: boolean,
  actorUserId: string | null,
  name: string,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };

  const serverName = normalizeMcpName(name);
  if (!serverName) return { ok: false, error: MCP_NAME_ERROR };

  if (actorUserId) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
    if (!user) return { ok: false, error: "The selected account no longer exists." };
    if (!isStoreAdmin(await getStoreRole(actorUserId, (await panelStore()).id))) return { ok: false, error: "MCP must act as an admin of this store." };
  }

  try {
    await saveMcpAccess((await panelStore()).id, { name: serverName, httpEnabled, actorUserId });
    revalidatePath("/panel/settings", "layout");
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
    const token = await issueMcpToken((await panelStore()).id);
    revalidatePath("/panel/settings", "layout");
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
    await revokeMcpToken((await panelStore()).id);
    revalidatePath("/panel/settings", "layout");
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
    // The bot belongs to the store being edited; its webhook and reply links use that store's domain.
    const origin = await panelStoreOrigin();
    const secret = await saveTelegramBot((await panelStore()).id, { token: trimmed, username: bot.username ?? String(bot.id), origin });
    const webhook = origin.startsWith("https://");
    if (webhook) {
      await telegram(trimmed, "setWebhook", {
        url: `${origin}/api/telegram/webhook`,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
    }
    await telegram(trimmed, "setMyCommands", { commands: BOT_COMMANDS }).catch(() => undefined);
    revalidatePath("/panel/settings", "layout");
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
    const storeId = (await panelStore()).id;
    const { token } = await getTelegramConfig(storeId);
    if (token) await telegram(token, "deleteWebhook").catch(() => undefined);
    await clearTelegramBot(storeId);
    revalidatePath("/panel/settings", "layout");
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
    await saveTelegramOptions((await panelStore()).id, { enabled: input.enabled, model, contentModel, imageModel });
    revalidatePath("/panel/settings", "layout");
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

  const storeId = (await panelStore()).id;
  const { username } = await getTelegramConfig(storeId);
  if (!username) return { ok: false, error: "Connect a bot first." };
  const code = await createPairingCode(storeId, session.user.id);
  return { ok: true, code, url: `https://t.me/${username}?start=${code}` };
}

export async function removeTelegramLinkAction(telegramUserId: number): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: FORBIDDEN };
  if (!Number.isSafeInteger(telegramUserId)) return { ok: false, error: "Invalid account." };

  await removeTelegramLink((await panelStore()).id, telegramUserId);
  revalidatePath("/panel/settings", "layout");
  return { ok: true };
}
