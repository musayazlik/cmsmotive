import { validateCompliance } from "@/lib/product-compliance";
import { publicationError } from "@/lib/publication";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { assertAssetsExist, isExtensionStatus, validateCore, validateDetail, validatePosition } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/extensions/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

  const { id } = await context.params;
  const existing = await prisma.extension.findFirst({ where: { id, storeId }, select: { id: true } });
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

  const order = validatePosition(body);
  if ("error" in order) return Response.json({ error: order.error }, { status: 400 });
  const position = order.data;

  const compliance = validateCompliance(body.compliance);
  if ("error" in compliance) return Response.json({ error: compliance.error }, { status: 400 });
  const releaseError = await publicationError(storeId, body.status, String(body.name ?? ""), compliance.data);
  if (releaseError) return Response.json({ error: releaseError }, { status: 400 });
  const detail = validateDetail(body);
  if ("error" in detail) return Response.json({ error: detail.error }, { status: 400 });

  const assetError = await assertAssetsExist(storeId, [coverId, ...galleryIds], prisma);
  if (assetError) return assetError;

  try {
    const extension = await prisma.$transaction(async (tx) => {
      await tx.extensionGallery.deleteMany({ where: { extensionId: id } });
      return tx.extension.update({
        where: { id, storeId },
        data: {
          name, slug, summary, description, position,
          ...detail.data,
          compliance: compliance.data,
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
  const storeId = (await panelStore()).id;

  const { id } = await context.params;
  const existing = await prisma.extension.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!existing) return Response.json({ error: "Extension not found." }, { status: 404 });

  try {
    await prisma.extension.delete({ where: { id, storeId } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrors(error, "The extension could not be deleted.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
