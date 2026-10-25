export type ActivitySource = "chat" | "mcp" | "telegram";
export type ActivityStatus = "running" | "waiting" | "completed" | "failed" | "cancelled" | "expired";
export type ActivityStep = { detail: string; at: string; failed?: boolean };
export type AssistantActivity = {
  id: string;
  source: ActivitySource;
  title: string;
  status: ActivityStatus;
  detail: string;
  steps: ActivityStep[];
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export const ACTIVITY_HISTORY_LIMIT = 20;
export const ACTIVITY_STEP_LIMIT = 40;
export const ACTIVITY_LEASE_MS = 2 * 60_000;
export const ACTIVITY_WAIT_MS = 15 * 60_000;

export function isActiveActivity(status: ActivityStatus): boolean {
  return status === "running" || status === "waiting";
}

/** A crashed process or unanswered Telegram confirmation must not run forever. */
export function effectiveActivityStatus(status: ActivityStatus, expiresAt: Date, now = Date.now()): ActivityStatus {
  return isActiveActivity(status) && expiresAt.getTime() <= now ? "expired" : status;
}

export function encodeActivityEvent(activities: AssistantActivity[]): string {
  return `event: activities\ndata: ${JSON.stringify({ activities })}\n\n`;
}
