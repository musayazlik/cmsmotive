"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile } from "@/lib/media-storage";
import { requireAdmin } from "@/lib/admin-guard";
import type { ActionResult } from "./_lib";
import { panelStore } from "@/lib/panel-store";

/**
 * Media mutations for the panel. Every action re-checks the admin role
 * because server actions are reachable endpoints, unlike the page layout
 * guard.
 */

/**
 * Deletes a file from UploadThing storage and, when tracked, its
 * MediaAsset row. Schema-wise the delete is safe: covers detach via
 * onDelete: SetNull and gallery rows cascade.
 */
export async function deleteMedia(key: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };
  if (!key) return { ok: false, error: "File key is required." };

  const storeId = (await panelStore()).id;
  // A file another store owns is never deleted from this store's library.
  const owner = await prisma.mediaAsset.findFirst({ where: { key, storeId: { not: storeId } }, select: { id: true } });
  const release = await prisma.productRelease.findFirst({ where: { fileKey: key, product: { storeId: { not: storeId } } }, select: { id: true } });
  if (owner || release) return { ok: false, error: "This file belongs to another store." };
  const asset = await prisma.mediaAsset.findUnique({ where: { storeId_key: { storeId, key } }, select: { id: true } });

  // Storage first: if UploadThing rejects, the database record still
  // describes a real file and nothing is left dangling.
  try {
    await deleteMediaFile(key);
  } catch (error) {
    console.error("deleteMedia (storage) failed", error);
    return { ok: false, error: "The file could not be deleted from storage. The library record was kept; try again." };
  }

  try {
    if (asset) await prisma.mediaAsset.delete({ where: { id: asset.id } });
    revalidatePath("/panel/media");
  } catch (error) {
    console.error("deleteMedia (database) failed", error);
    return {
      ok: false,
      error: "Removed from storage, but the database record could not be deleted. Try again.",
    };
  }

  return { ok: true };
}
