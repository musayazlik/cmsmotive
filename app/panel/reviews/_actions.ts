"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { isReviewStatus } from "@/lib/reviews";
import type { ActionResult } from "./_lib";
import { panelStore } from "@/lib/panel-store";

/**
 * Review moderation. Every action re-checks the admin role because server
 * actions are reachable endpoints, unlike the page layout guard. Product
 * pages read approved reviews through /api/reviews, so nothing public needs
 * revalidating here.
 */

function refresh() {
  revalidatePath("/panel/reviews");
}

export async function setReviewStatus(id: string, status: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };
  if (!isReviewStatus(status)) return { ok: false, error: "Unknown review status." };

  try {
    await prisma.productReview.update({
      where: { id, storeId: (await panelStore()).id },
      data: { status, moderatedAt: status === "pending" ? null : new Date() },
    });
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("setReviewStatus failed", error);
    return { ok: false, error: "The review could not be updated." };
  }
}

export async function deleteReview(id: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    await prisma.productReview.delete({ where: { id, storeId: (await panelStore()).id } });
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("deleteReview failed", error);
    return { ok: false, error: "The review could not be deleted." };
  }
}
