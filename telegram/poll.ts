import "../mcp/env";

import { getTelegramConfig } from "@/lib/telegram-settings";
import { getWebhookInfo, telegram, type TgUpdate } from "./api";
import { handleUpdate } from "./handler";
import { BOT_COMMANDS } from "./modes";

/**
 * Local development without a public HTTPS URL: long-polls Telegram instead
 * of receiving the webhook. Run `pnpm telegram:poll`. Telegram delivers an
 * update either to a webhook or to getUpdates, never both, so a registered
 * webhook is only removed with --force (reconnect the bot in the panel to
 * restore it).
 */
async function main() {
  const config = await getTelegramConfig();
  if (!config.token) throw new Error("Connect a bot under Settings → Telegram first.");
  if (!config.enabled) throw new Error("The bot is switched off under Settings → Telegram.");

  const webhook = await getWebhookInfo(config.token);
  if (webhook.url) {
    if (!process.argv.includes("--force")) {
      throw new Error(`A webhook is registered (${webhook.url}). Rerun with --force to remove it and poll instead.`);
    }
    await telegram(config.token, "deleteWebhook");
    console.error("[telegram] webhook removed");
  }

  // Refreshes the command menu, which is otherwise only set when the bot is connected.
  await telegram(config.token, "setMyCommands", { commands: BOT_COMMANDS }).catch((error) =>
    console.error("[telegram] setMyCommands failed", error),
  );
  console.error(`[telegram] polling as @${config.username}`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram<TgUpdate[]>(
        config.token,
        "getUpdates",
        { offset, timeout: 30, allowed_updates: ["message", "callback_query"] },
        40_000,
      );
      for (const update of updates) {
        offset = update.update_id + 1;
        // Not awaited: a long agent run in one chat must not hold up the others.
        void handleUpdate(update).catch((error) => console.error("[telegram] update failed", error));
      }
    } catch (error) {
      console.error("[telegram] poll failed, retrying", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch((error) => {
  console.error("[telegram]", error instanceof Error ? error.message : error);
  process.exit(1);
});
