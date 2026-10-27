import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { deleteSnippet, listSnippets, saveSnippet } from "@/lib/page-builder/snippets";

export const runtime = "nodejs";

/**
 * Saved sections and templates for the editor's insert panel (Faz 4). The
 * heavy apply logic is client-side (regenerated ids + the normal draft door);
 * this route only stores and lists.
 */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  return Response.json(await listSnippets((await panelStore()).id));
}

export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; kind?: unknown; category?: unknown; data?: unknown }
    | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const result = await saveSnippet((await panelStore()).id, {
    name: body.name,
    kind: body.kind,
    category: body.category,
    data: body.data,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status ?? 400 });
  return Response.json({ ok: true, id: result.data.id });
}

export async function DELETE(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Invalid request." }, { status: 400 });
  const result = await deleteSnippet((await panelStore()).id, id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status ?? 400 });
  return Response.json({ ok: true });
}
