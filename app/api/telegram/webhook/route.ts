import { after } from "next/server";
import { getTelegramConfig, isValidWebhookSecret } from "@/lib/telegram-settings";
import type { TgUpdate } from "@/telegram/api";
import { handleUpdate } from "@/telegram/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram webhook, registered from Settings → Telegram. Telegram signs each
 * call with the secret_token given to setWebhook. The update is acknowledged
 * at once and handled after the response, because an agent run (AI images
 * included) can take far longer than Telegram waits before redelivering.
 */
export async function POST(request: Request): Promise<Response> {
  const config = await getTelegramConfig();
  if (!isValidWebhookSecret(config, request.headers.get("x-telegram-bot-api-secret-token"))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return Response.json({ error: "Invalid update." }, { status: 400 });
  }

  after(() => handleUpdate(update).catch((error) => console.error("[telegram] update failed", error)));
  return Response.json({ ok: true });
}
