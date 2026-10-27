import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

/**
 * GET /api/admin/pages/:id/revisions?locale=&revision= — one revision's
 * document for the editor's compare view and "Restore" button (Faz 4).
 * Restoring itself goes through the normal draft door client-side, so
 * validation and the version bump stay in lib/page-builder/pages.ts.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const revisionId = url.searchParams.get("revision");
  if (!locale || !revisionId) return Response.json({ error: "Invalid request." }, { status: 400 });

  const storeId = (await panelStore()).id;
  const revision = await prisma.pageRevision.findFirst({
    where: { id: revisionId, pageLocale: { locale, page: { id: (await context.params).id, storeId } } },
    select: { id: true, note: true, createdAt: true, data: true },
  });
  if (!revision) return Response.json({ error: "Revision not found." }, { status: 404 });
  return Response.json(revision);
}
