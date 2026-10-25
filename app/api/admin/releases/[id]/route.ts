import { requireAdmin } from "@/lib/admin-guard";
import { findStoreProduct } from "@/lib/product-admin";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import { utapi } from "@/lib/utapi";

export const runtime = "nodejs";

/**
 * DELETE /api/admin/releases/:id — removes a package version from private
 * storage. Customers lose access to that version, so this is for packages
 * uploaded by mistake.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const release = await prisma.productRelease.findUnique({ where: { id: (await context.params).id } });
  if (!release || !(await findStoreProduct((await panelStore()).id, release.productId))) {
    return Response.json({ error: "Release not found." }, { status: 404 });
  }
  try {
    await utapi.deleteFiles(release.fileKey);
  } catch (error) {
    console.error("release delete: storage", error);
    return Response.json({ error: "The package could not be deleted from storage." }, { status: 502 });
  }
  await prisma.productRelease.delete({ where: { id: release.id } });
  return Response.json({ ok: true });
}
