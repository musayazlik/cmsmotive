import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { listActivities } from "@/lib/assistant-activity";
import { activityStream } from "@/lib/assistant-activity-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const store = await panelStore();
  // A store switch in another tab cannot silently feed this tab another store's activity.
  if (new URL(request.url).searchParams.get("storeId") !== store.id) return new Response(null, { status: 409 });
  return new Response(activityStream(() => listActivities(store.id), request.signal), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
