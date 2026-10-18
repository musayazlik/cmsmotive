import { isAdminRole } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import {
  consumePairingCode,
  getTelegramConfig,
  saveTelegramLink,
  type TelegramConfig,
} from "@/lib/telegram-settings";
import type { TelegramLink } from "@/lib/telegram-settings-shared";
import { runAsActor } from "@/mcp/context";
import { uploadMediaRecord } from "@/mcp/lib/media";
import { appendHistory, clearConversation, dropPending, resumeAgent, runAgent, type AgentContext } from "./agent";
import { handleDraftAction, isDraftAction } from "./drafts";
import { downloadFile, sendText, telegram, type TgCallbackQuery, type TgMessage, type TgUpdate } from "./api";

/**
 * Entry point for every Telegram update, from the webhook route or the local
 * polling script. Only private chats with linked accounts reach the agent;
 * everyone else gets a short refusal with their Telegram id.
 */

const HELP = [
  "**CMSMotive panel bot**",
  "Write what you need in plain words, for example:",
  "• Write a draft post about TYPO3 14 accessibility and generate a cover",
  "• Make the cover of the last post darker, with more lime",
  "• Show pending reviews and approve the 5-star ones",
  "• Send a photo with the caption “use this as the cover of <post>”",
  "",
  "/new — start a fresh conversation",
  "/whoami — the panel account the bot acts as",
].join("\n");

// One run per chat at a time; a second message waits for the first to finish.
const chatLocks = new Map<number, Promise<unknown>>();
function withChatLock(chatId: number, task: () => Promise<void>): Promise<void> {
  const previous = chatLocks.get(chatId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  chatLocks.set(chatId, next);
  return next.finally(() => {
    if (chatLocks.get(chatId) === next) chatLocks.delete(chatId);
  });
}

// Telegram redelivers an update when the webhook answer is slow; seen ids are skipped.
const seenUpdates = new Set<number>();
function firstDelivery(updateId: number): boolean {
  if (seenUpdates.has(updateId)) return false;
  seenUpdates.add(updateId);
  if (seenUpdates.size > 500) seenUpdates.delete(seenUpdates.values().next().value!);
  return true;
}

function agentContext(config: TelegramConfig, chatId: number): AgentContext {
  return {
    token: config.token!,
    chatId,
    origin: config.origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    model: config.model,
    contentModel: config.contentModel,
    imageModel: config.imageModel,
  };
}

async function reportError(token: string, chatId: number, error: unknown) {
  console.error("[telegram] run failed", error);
  const message = error instanceof Error ? error.message : String(error);
  await sendText(token, chatId, `Something went wrong: ${message.slice(0, 400)}`).catch(() => undefined);
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (!firstDelivery(update.update_id)) return;
  const config = await getTelegramConfig();
  if (!config.enabled || !config.token) return;

  if (update.callback_query) return handleCallback(config, update.callback_query);
  if (update.message) return handleMessage(config, update.message);
}

async function linkAccount(config: TelegramConfig, message: TgMessage, code: string) {
  const token = config.token!;
  const from = message.from!;
  const userId = await consumePairingCode(code);
  if (!userId) {
    await sendText(token, message.chat.id, "This link code is invalid or has expired. Create a new one under Settings → Telegram.");
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user || !isAdminRole(user.role)) {
    await sendText(token, message.chat.id, "The panel account that created this code is not an admin.");
    return;
  }
  const link: TelegramLink = {
    telegramUserId: from.id,
    chatId: message.chat.id,
    username: from.username ?? null,
    name: [from.first_name, from.last_name].filter(Boolean).join(" "),
    userId,
    linkedAt: new Date().toISOString(),
  };
  await saveTelegramLink(link);
  await sendText(token, message.chat.id, `Linked to the panel account **${user.email}**.\n\n${HELP}`);
}

/** A photo or image document the user sent, stored in the media library. */
async function storeAttachment(config: TelegramConfig, message: TgMessage, userId: string): Promise<string | null> {
  const photo = message.photo?.at(-1);
  const document = message.document?.mime_type?.startsWith("image/") ? message.document : undefined;
  const fileId = photo?.file_id ?? document?.file_id;
  if (!fileId) return null;

  const { buffer, path } = await downloadFile(config.token!, fileId);
  const extension = path.split(".").pop() || "jpg";
  const media = await runAsActor(userId, () =>
    uploadMediaRecord(
      {
        fileName: document?.file_name ?? `telegram-${message.message_id}.${extension}`,
        mimeType: document?.mime_type ?? `image/${extension === "jpg" ? "jpeg" : extension}`,
        base64: buffer.toString("base64"),
      },
      userId,
    ),
  );
  return `[The user attached an image. It is stored in the media library as id ${media.id}, url ${media.url}.]`;
}

async function handleMessage(config: TelegramConfig, message: TgMessage) {
  const token = config.token!;
  const chatId = message.chat.id;
  if (message.chat.type !== "private" || !message.from) return;

  const text = (message.text ?? message.caption ?? "").trim();
  const start = /^\/(?:start|link)(?:@\w+)?\s+([\w-]{8,64})$/.exec(text);
  if (start) return linkAccount(config, message, start[1]);

  const link = config.links.find((entry) => entry.telegramUserId === message.from!.id);
  if (!link) {
    // Telegram clients that already have the chat open often drop the deep-link
    // payload and send a bare /start, so the code can also be pasted on its own.
    if (/^[\w-]{12}$/.test(text)) return linkAccount(config, message, text);
    await sendText(
      token,
      chatId,
      `This bot only works for linked CMSMotive admins. Open Settings → Telegram in the panel, press “Link my Telegram” and paste the code shown there into this chat.\n\nYour Telegram id: \`${message.from.id}\``,
    );
    return;
  }

  const command = /^\/(\w+)/.exec(text)?.[1]?.toLowerCase();
  if (command === "start" || command === "help") return sendText(token, chatId, HELP);
  if (command === "new") {
    await clearConversation(chatId);
    return sendText(token, chatId, "Started a fresh conversation.");
  }
  if (command === "whoami") {
    const user = await prisma.user.findUnique({ where: { id: link.userId }, select: { email: true, role: true } });
    return sendText(token, chatId, user ? `Acting as **${user.email}** (${user.role}).` : "The linked panel account no longer exists.");
  }

  await withChatLock(chatId, async () => {
    try {
      if (await dropPending(chatId)) await sendText(token, chatId, "The action that was waiting for confirmation was cancelled.");
      const attachment = await storeAttachment(config, message, link.userId);
      const prompt = [text, attachment].filter(Boolean).join("\n\n");
      if (!prompt) return;
      await runAsActor(link.userId, () => runAgent(agentContext(config, chatId), prompt));
    } catch (error) {
      await reportError(token, chatId, error);
    }
  });
}

async function handleCallback(config: TelegramConfig, query: TgCallbackQuery) {
  const token = config.token!;
  const chatId = query.message?.chat.id;
  const data = query.data ?? "";
  const match = /^(confirm|cancel):(\w+)$/.exec(data);
  const link = config.links.find((entry) => entry.telegramUserId === query.from.id);
  await telegram(token, "answerCallbackQuery", { callback_query_id: query.id }).catch(() => undefined);
  if (!chatId || !link || (!match && !isDraftAction(data))) return;

  // The buttons are single-use: remove them before running anything.
  if (query.message) {
    await telegram(token, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => undefined);
  }

  await withChatLock(chatId, async () => {
    try {
      if (!match) {
        // Publish / Discard on a post card: the user's own decision, no model involved.
        const decision = await runAsActor(link.userId, () => handleDraftAction(agentContext(config, chatId), data));
        if (decision) await appendHistory(chatId, [{ role: "user", content: `(Tapped a button) ${decision}` }]);
        return;
      }
      const resumed = await runAsActor(link.userId, () =>
        resumeAgent(agentContext(config, chatId), match[2], match[1] === "confirm"),
      );
      if (!resumed) await sendText(token, chatId, "This confirmation has expired. Ask again if you still want it.");
    } catch (error) {
      await reportError(token, chatId, error);
    }
  });
}
