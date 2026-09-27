"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { utapi } from "@/lib/utapi";
import { requireAdmin } from "@/lib/admin-guard";
import type { ActionResult } from "./_lib";

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

  const asset = await prisma.mediaAsset.findUnique({ where: { key }, select: { id: true } });

  // Storage first: if UploadThing rejects, the database record still
  // describes a real file and nothing is left dangling.
  let storageDeleted = true;
  try {
    await utapi.deleteFiles(key);
  } catch (error) {
    storageDeleted = false;
    if (!asset) {
      console.error("deleteMedia (storage) failed", error);
      return { ok: false, error: "The file could not be deleted from storage." };
    }
    // No storage copy behind this row — fall through and clean the record.
  }

  try {
    await prisma.mediaAsset.delete({ where: { key } });
    revalidatePath("/panel/media");
  } catch (error) {
    console.error("deleteMedia (database) failed", error);
    return {
      ok: false,
      error: storageDeleted
        ? "Removed from storage, but the database record could not be deleted. Try again."
        : "The file could not be deleted.",
    };
  }

  if (!storageDeleted) {
    return { ok: false, error: "The file was already gone from storage; the stale database record was removed." };
  }
  return { ok: true };
}
