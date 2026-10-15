import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { validateChangelog } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";
import { productExists } from "@/lib/changelog";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/changelog/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;
  const existing = await prisma.changelogEntry.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "Changelog entry not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const validated = validateChangelog(body);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });
  if (!(await productExists(validated.data))) {
    return Response.json({ error: "The chosen theme or extension no longer exists." }, { status: 400 });
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

  const { id } = await context.params;
  try {
    await prisma.changelogEntry.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrors(error, "The changelog entry could not be deleted.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
