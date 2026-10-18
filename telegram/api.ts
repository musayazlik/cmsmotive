/**
 * Minimal Telegram Bot API client: only the methods the bot uses. Every call
 * takes the token explicitly, so the settings page can verify a new token
 * before it is saved.
 */

const API = "https://api.telegram.org";

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

export async function telegram<T>(token: string, method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string; error_code?: number }
    | null;
  if (!payload) throw new TelegramError(`Telegram ${method} failed (HTTP ${response.status}).`, response.status);
  if (!payload.ok) throw new TelegramError(`Telegram ${method}: ${payload.description ?? "failed"}`, payload.error_code ?? null);
  return payload.result;
}

/* -------------------------------------------------------------- update types */

export type TgUser = { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string };
export type TgChat = { id: number; type: "private" | "group" | "supergroup" | "channel" };
export type TgPhotoSize = { file_id: string; width: number; height: number; file_size?: number };
export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
};
export type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery };

export type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

/* ----------------------------------------------------------------- helpers */

export const getMe = (token: string) => telegram<TgUser>(token, "getMe");

export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
};
export const getWebhookInfo = (token: string) => telegram<WebhookInfo>(token, "getWebhookInfo");

/** Telegram caps messages at 4096 characters; long replies are split on line breaks. */
function chunks(text: string, size = 3900): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf("\n", size);
    const at = cut > size / 2 ? cut : size;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n/, "");
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Sends a reply written in Markdown. It is converted to Telegram HTML; if
 * Telegram rejects the markup, the plain text is sent instead.
 */
export async function sendText(token: string, chatId: number, markdown: string, keyboard?: InlineKeyboard) {
  const parts = chunks(markdown.trim() || "…");
  for (const [index, part] of parts.entries()) {
    const markup = index === parts.length - 1 && keyboard ? { reply_markup: keyboard } : {};
    try {
      await telegram(token, "sendMessage", {
        chat_id: chatId,
        text: markdownToTelegramHtml(part),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...markup,
      });
    } catch (error) {
      if (!(error instanceof TelegramError) || error.code !== 400) throw error;
      await telegram(token, "sendMessage", { chat_id: chatId, text: part, ...markup });
    }
  }
}

export async function sendPhoto(token: string, chatId: number, url: string, caption?: string) {
  await telegram(token, "sendPhoto", {
    chat_id: chatId,
    photo: url,
    ...(caption ? { caption: markdownToTelegramHtml(caption.slice(0, 1000)), parse_mode: "HTML" } : {}),
  });
}

export async function sendTyping(token: string, chatId: number, action: "typing" | "upload_photo" = "typing") {
  await telegram(token, "sendChatAction", { chat_id: chatId, action }).catch(() => undefined);
}

/** Downloads a file the user sent (photo or document). */
export async function downloadFile(token: string, fileId: string): Promise<{ buffer: Buffer; path: string }> {
  const file = await telegram<{ file_path?: string }>(token, "getFile", { file_id: fileId });
  if (!file.file_path) throw new TelegramError("Telegram returned no file path.", null);
  const response = await fetch(`${API}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new TelegramError(`File download failed (HTTP ${response.status}).`, response.status);
  return { buffer: Buffer.from(await response.arrayBuffer()), path: file.file_path };
}

/* -------------------------------------------------------------- formatting */

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The small Markdown subset models write (bold, italic, code, links,
 * headings, fenced code) as the HTML Telegram accepts. Everything else is
 * escaped, so the output is always valid.
 */
export function markdownToTelegramHtml(markdown: string): string {
  const blocks: string[] = [];
  let text = markdown.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_match, code: string) => {
    blocks.push(`<pre>${escapeHtml(code.replace(/\n$/, ""))}</pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  text = escapeHtml(text)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/__([^_\n]+)__/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/gm, "$1<i>$2</i>")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => `<a href="${url.replace(/"/g, "&quot;")}">${label}</a>`)
    .replace(/^\s*[-*]\s+/gm, "• ");
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => blocks[Number(index)]);
}
