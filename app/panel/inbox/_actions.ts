"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import type { ActionResult } from "./_lib";

/**
 * Inbox mutations for contact form messages. Every action re-checks the admin
 * role because server actions are reachable endpoints, unlike the page layout
 * guard. Messages are never deleted from here — archiving is reversible and
 * keeps the original submission on record.
 */

function refreshInbox() {
  revalidatePath("/panel/inbox");
}

export async function setInquiryRead(id: string, read: boolean): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    await prisma.contactInquiry.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });
    refreshInbox();
    return { ok: true };
  } catch (error) {
    console.error("setInquiryRead failed", error);
    return { ok: false, error: "The message could not be updated." };
  }
}

export async function setInquiryArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    // Archiving a message also settles it: an archived message no longer
    // counts as unread even if it was never opened.
    const current = await prisma.contactInquiry.findUnique({
      where: { id },
      select: { readAt: true },
    });
    if (!current) return { ok: false, error: "This message no longer exists." };

    await prisma.contactInquiry.update({
      where: { id },
      data: archived
        ? { archivedAt: new Date(), readAt: current.readAt ?? new Date() }
        : { archivedAt: null },
    });
    refreshInbox();
    return { ok: true };
  } catch (error) {
    console.error("setInquiryArchived failed", error);
    return { ok: false, error: "The message could not be updated." };
  }
}
