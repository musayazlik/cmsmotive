import { createHash, timingSafeEqual } from "node:crypto";
import { runNotificationJobs } from "@/lib/notifications";

/**
 * Scheduled job: announces new releases, queues dated reminders (renewal in
 * 3 days, access ending, updates ending) and mails pending notifications.
 * Safe to call as often as wanted (every 15–60 minutes is plenty); every
 * message has a dedupe key. Call it with `Authorization: Bearer $CRON_SECRET`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const digest = (value: string) => createHash("sha256").update(value).digest();

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return new Response("Cron is not configured", { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await runNotificationJobs(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("notification job failed", error instanceof Error ? error.message : error);
    return new Response("Notification job failed", { status: 500 });
  }
}

export const GET = run;
export const POST = run;
