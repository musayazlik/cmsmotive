import { requireAdmin } from "@/lib/admin-guard";
import { getSystemStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live host metrics for the overview charts; polled by the panel. */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  return Response.json(await getSystemStatus());
}
