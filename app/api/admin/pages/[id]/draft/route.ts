import { requireAdmin } from "@/lib/admin-guard";
import { saveDraft } from "@/lib/page-builder/pages";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

/**
 * POST /api/admin/pages/:id/draft — the editor's autosave endpoint
 * (plan 5.6): validates and cleans the document through the single write
 * path (lib/page-builder/pages.ts → document.ts) and bumps `version`, so two
 * admins editing at once get a 409 with the current version instead of a
 * silent overwrite.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  const body = (await request.json().catch(() => null)) as
    | { locale?: unknown; doc?: unknown; expectedVersion?: unknown }
    | null;
  const expectedVersion = body?.expectedVersion;
  if (!body || typeof body.locale !== "string" || typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = await saveDraft(
    (await panelStore()).id,
    (await context.params).id,
    body.locale,
    body.doc,
    expectedVersion,
    session?.user.id,
  );
  if (result.ok) return Response.json({ ok: true, version: result.version });
  if (result.conflict) return Response.json({ ok: false, conflict: true, version: result.currentVersion }, { status: 409 });
  return Response.json({ ok: false, error: result.error }, { status: result.status });
}
