import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_HISTORY_LIMIT, ACTIVITY_LEASE_MS, ACTIVITY_STEP_LIMIT, ACTIVITY_WAIT_MS,
  effectiveActivityStatus, isActiveActivity,
  type ActivitySource, type ActivityStatus, type ActivityStep, type AssistantActivity,
} from "./assistant-activity-shared";

type ActivityContext = {
  id: string | null;
  storeId: string;
  status: ActivityStatus;
  hadError: boolean;
  steps: ActivityStep[];
  // Serialize progress writes from nested/concurrent tools in the same run.
  writes: Promise<void>;
};
const scope = new AsyncLocalStorage<ActivityContext>();

function logFailure() {
  // Observability must not break the underlying operation or expose payloads.
  console.error("[assistant-activity] Could not persist activity.");
}

export function currentActivityId(): string | undefined {
  return scope.getStore()?.id ?? undefined;
}

export async function activityStep(detail: string, options: { status?: ActivityStatus; failed?: boolean } = {}): Promise<void> {
  const context = scope.getStore();
  if (!context?.id) return;
  const { status = "running", failed = false } = options;
  context.status = status;
  context.hadError ||= failed;
  context.steps = [...context.steps, { detail, at: new Date().toISOString(), ...(failed ? { failed: true } : {}) }].slice(-ACTIVITY_STEP_LIMIT);
  const data = {
    status, detail, steps: context.steps,
    expiresAt: new Date(Date.now() + (status === "waiting" ? ACTIVITY_WAIT_MS : ACTIVITY_LEASE_MS)),
    finishedAt: isActiveActivity(status) ? null : new Date(),
  };
  context.writes = context.writes.then(async () => {
    await prisma.assistantActivity.updateMany({ where: { id: context.id!, storeId: context.storeId }, data });
  }).catch(logFailure);
  await context.writes;
}

type ActivityOptions = { storeId: string; source: ActivitySource; title: string; resumeId?: string };

/** Used by chat, Telegram runs and MCP tools, including stdio in another process. */
export async function trackActivity<T>(options: ActivityOptions, action: () => Promise<T>): Promise<T> {
  // A Telegram tool remains a step of the Telegram run, rather than a duplicate MCP activity.
  if (scope.getStore()?.storeId === options.storeId) {
    if (options.source === "mcp") await activityStep(options.title);
    return action();
  }
  let id: string | null = null;
  let steps: ActivityStep[] = [];
  try {
    const previous = options.resumeId ? await prisma.assistantActivity.findFirst({
      where: { id: options.resumeId, storeId: options.storeId, source: options.source, status: "waiting", expiresAt: { gt: new Date() } },
    }) : null;
    if (previous) {
      id = previous.id;
      steps = previous.steps as ActivityStep[];
    } else {
      const record = await prisma.assistantActivity.create({ data: {
        storeId: options.storeId, source: options.source, title: options.title,
        detail: "Starting…", expiresAt: new Date(Date.now() + ACTIVITY_LEASE_MS),
      } });
      id = record.id;
    }
  } catch { logFailure(); }

  const context: ActivityContext = { id, storeId: options.storeId, status: "running", hadError: steps.some((step) => step.failed), steps, writes: Promise.resolve() };
  return scope.run(context, async () => {
    await activityStep(options.resumeId ? "Resuming operation…" : "Starting…");
    // Long AI calls can take many minutes. The lease also recovers from process crashes.
    const heartbeat = setInterval(() => {
      if (context.status !== "running" || !context.id) return;
      context.writes = context.writes.then(async () => {
        await prisma.assistantActivity.updateMany({
          where: { id: context.id!, storeId: context.storeId, status: "running" },
          data: { expiresAt: new Date(Date.now() + ACTIVITY_LEASE_MS) },
        });
      }).catch(logFailure);
    }, 30_000);
    heartbeat.unref();
    try {
      const result = await action();
      if (context.status === "running") {
        await activityStep(context.hadError ? "Finished with errors. Check the source conversation or tool response." : "Completed.", {
          status: context.hadError ? "failed" : "completed",
        });
      }
      return result;
    } catch (error) {
      await activityStep("The operation could not be completed. Check the source conversation or tool response.", { status: "failed", failed: true });
      throw error;
    } finally {
      clearInterval(heartbeat);
      await context.writes;
    }
  });
}

export async function cancelActivity(storeId: string, id: string | undefined): Promise<void> {
  if (!id) return;
  await prisma.assistantActivity.updateMany({
    where: { id, storeId, status: "waiting" },
    data: { status: "cancelled", detail: "Cancelled in Telegram.", finishedAt: new Date() },
  }).catch(logFailure);
}

/** A Telegram question can advance without starting another model/tool run. */
export async function waitingActivityStep(storeId: string, id: string | undefined, detail: string): Promise<void> {
  if (!id) return;
  try {
    const record = await prisma.assistantActivity.findFirst({ where: { id, storeId, source: "telegram", status: "waiting", expiresAt: { gt: new Date() } } });
    if (!record) return;
    const steps = [...record.steps as ActivityStep[], { detail, at: new Date().toISOString() }].slice(-ACTIVITY_STEP_LIMIT);
    // Preserve the pending question's original expiry.
    await prisma.assistantActivity.updateMany({ where: { id, storeId, status: "waiting" }, data: { detail, steps } });
  } catch { logFailure(); }
}

export async function listActivities(storeId: string): Promise<AssistantActivity[]> {
  const now = new Date();
  // Active work is never pushed out by a burst of completed tool calls.
  const [active, recent] = await Promise.all([
    prisma.assistantActivity.findMany({
      where: { storeId, status: { in: ["running", "waiting"] }, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.assistantActivity.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: ACTIVITY_HISTORY_LIMIT }),
  ]);
  const records = [...new Map([...active, ...recent].map((record) => [record.id, record])).values()];
  return records.map((record) => {
    const status = effectiveActivityStatus(record.status as ActivityStatus, record.expiresAt, now.getTime());
    return {
      id: record.id, source: record.source as ActivitySource, title: record.title, status,
      detail: status === "expired" ? "The operation stopped reporting progress or the Telegram response expired." : record.detail,
      steps: record.steps as ActivityStep[], createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      finishedAt: status === "expired" ? record.expiresAt.toISOString() : record.finishedAt?.toISOString() ?? null,
    };
  });
}
