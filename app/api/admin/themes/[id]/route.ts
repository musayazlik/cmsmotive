import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { assertAssetsExist, isThemeStatus, THEME_INDUSTRIES, validateCore, VERSION_TARGETS } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/themes/:id */
export async function PATCH(request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;
  const existing = await prisma.theme.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "Theme not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const validated = validateCore(body);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });
  const { name, slug, summary, description, coverId, galleryIds } = validated.data;

  const industry = typeof body.industry === "string" ? body.industry.trim() : "";
  if (!(THEME_INDUSTRIES as readonly string[]).includes(industry)) {
    return Response.json({ error: `Industry must be one of: ${THEME_INDUSTRIES.join(", ")}.` }, { status: 400 });
  }

  const versionTarget = typeof body.versionTarget === "string" ? body.versionTarget.trim() : "";
  if (!(VERSION_TARGETS as readonly string[]).includes(versionTarget)) {
    return Response.json({ error: `Version target must be one of: ${VERSION_TARGETS.join(", ")}.` }, { status: 400 });
  }

  if (!isThemeStatus(body.status)) {
    return Response.json({ error: "Status must be one of: concept, in-development, published." }, { status: 400 });
  }

  const assetError = await assertAssetsExist([coverId, ...galleryIds], prisma);
  if (assetError) return assetError;

  try {
    const theme = await prisma.$transaction(async (tx) => {
      await tx.themeGallery.deleteMany({ where: { themeId: id } });
      return tx.theme.update({
        where: { id },
        data: {
          name, slug, summary, description, industry, versionTarget,
          status: body.status as string,
          coverId,
          gallery: { create: galleryIds.map((assetId, position) => ({ assetId, position })) },
        },
        select: { id: true, slug: true, name: true, status: true, updatedAt: true },
      });
    });
    return Response.json({ theme: { ...theme, updatedAt: theme.updatedAt.toISOString() } });
  } catch (error) {
    return prismaErrors(error, "The theme could not be updated.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/** DELETE /api/admin/themes/:id */
export async function DELETE(_request: Request, context: Context) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;
  const existing = await prisma.theme.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "Theme not found." }, { status: 404 });

  try {
    await prisma.theme.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrors(error, "The theme could not be deleted.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
