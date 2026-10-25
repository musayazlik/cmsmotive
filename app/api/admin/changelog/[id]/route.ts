import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { validateChangelog } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";
import { changelogInStore, productExists } from "@/lib/changelog";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/changelog/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

  const { id } = await context.params;
  const existing = await prisma.changelogEntry.findFirst({ where: { id, ...changelogInStore(storeId) }, select: { id: true } });
  if (!existing) return Response.json({ error: "Changelog entry not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const validated = validateChangelog(body);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });
  if (!(await productExists(storeId, validated.data.productId))) {
    return Response.json({ error: "The chosen product no longer exists." }, { status: 400 });
  }

  try {
    const entry = await prisma.changelogEntry.update({ where: { id }, data: validated.data, select: { id: true } });
    return Response.json({ entry });
  } catch (error) {
    return prismaErrors(error, "The changelog entry could not be updated.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/** DELETE /api/admin/changelog/:id */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

  const { id } = await context.params;
  try {
    await prisma.changelogEntry.delete({ where: { id, ...changelogInStore(storeId) } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrors(error, "The changelog entry could not be deleted.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
