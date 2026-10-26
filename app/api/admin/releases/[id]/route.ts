import { requireAdmin } from "@/lib/admin-guard";
import { findStoreProduct } from "@/lib/product-admin";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getLegalSettings } from "@/lib/legal";
import { auditPackage } from "@/lib/package-audit";
import { deletePackageFile, readPackageFile } from "@/lib/package-storage";

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
    await deletePackageFile(release.fileKey);
  } catch (error) {
    console.error("release delete: storage", error);
    return Response.json({ error: "The package could not be deleted from storage." }, { status: 502 });
  }
  await prisma.productRelease.delete({ where: { id: release.id } });
  return Response.json({ ok: true });
}

/**
 * POST /api/admin/releases/:id — runs the licence audit again on a stored
 * package (uploaded before audits existed, or after the store's GPL setting
 * changed) and stores the report. It never deletes a release; the product's
 * publish checklist shows the outcome.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;
  const release = await prisma.productRelease.findUnique({ where: { id: (await context.params).id } });
  if (!release || !(await findStoreProduct(storeId, release.productId))) {
    return Response.json({ error: "Release not found." }, { status: 404 });
  }
  let file: Buffer;
  try {
    file = await readPackageFile(release.fileKey);
  } catch (error) {
    console.error("release audit: storage", error);
    return Response.json({ error: "The package could not be read from storage." }, { status: 502 });
  }
  const audit = auditPackage(file, { gplRequired: (await getLegalSettings(storeId)).gplCodeRequired, declaredLicense: release.codeLicense });
  await prisma.productRelease.update({ where: { id: release.id }, data: { audit: audit as Prisma.InputJsonObject } });
  return Response.json({ audit });
}
