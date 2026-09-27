import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { assertAssetsExist, isExtensionStatus, validateCore } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/extensions/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;
  const existing = await prisma.extension.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "Extension not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const validated = validateCore(body);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });
  const { name, slug, summary, description, coverId, galleryIds } = validated.data;

  if (!isExtensionStatus(body.status)) {
    return Response.json({ error: "Status must be one of: concept, planning, in-development, published." }, { status: 400 });
  }

  const assetError = await assertAssetsExist([coverId, ...galleryIds], prisma);
  if (assetError) return assetError;

  try {
    const extension = await prisma.$transaction(async (tx) => {
      await tx.extensionGallery.deleteMany({ where: { extensionId: id } });
      return tx.extension.update({
        where: { id },
        data: {
          name, slug, summary, description,
          status: body.status as string,
          coverId,
          gallery: { create: galleryIds.map((assetId, position) => ({ assetId, position })) },
        },
        select: { id: true, slug: true, name: true, status: true, updatedAt: true },
      });
    });
    return Response.json({ extension: { ...extension, updatedAt: extension.updatedAt.toISOString() } });
  } catch (error) {
    return prismaErrors(error, "The extension could not be updated.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/** DELETE /api/admin/extensions/:id */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;
  const existing = await prisma.extension.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "Extension not found." }, { status: 404 });

  try {
    await prisma.extension.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrors(error, "The extension could not be deleted.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
