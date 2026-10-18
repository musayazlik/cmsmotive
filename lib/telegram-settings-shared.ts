/**
 * Client-safe Telegram bot contract for the settings page. The bot token and
 * the webhook secret never leave the server (lib/telegram-settings.ts).
 */

/** A Telegram account allowed to use the bot, acting as a panel admin. */
export type TelegramLink = {
  telegramUserId: number;
  chatId: number;
  username: string | null;
  name: string;
  /** Panel account the bot acts as for this person. */
  userId: string;
  linkedAt: string;
};

export type TelegramSettings = {
  enabled: boolean;
  bot: { username: string; tokenHint: string } | null;
  /** Chat model: understands requests and calls tools; "" = automatic. */
  model: string;
  /** Writes post texts (ai_write_post / ai_rewrite_post); "" = Settings → AI. */
  contentModel: string;
  /** Generates and edits images; "" = Settings → AI. */
  imageModel: string;
  links: (TelegramLink & { userEmail: string | null })[];
};

/** How long a "link my Telegram" code stays valid. */
export const PAIRING_TTL_MS = 15 * 60 * 1000;
