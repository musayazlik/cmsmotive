"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { deliverPendingEmails } from "@/lib/notifications";
import { panelStore } from "@/lib/panel-store";
import { replyAsStaff, setTicketStatus } from "@/lib/support";

export type StaffReplyState = { status: "idle" | "ok" | "error"; message: string };

/** A team reply; `close` also closes the request. The customer is notified and mailed right away. */
export async function staffReplyAction(ticketId: string, _previous: StaffReplyState, formData: FormData): Promise<StaffReplyState> {
  const { session, failure } = await requireAdmin();
  if (failure) return { status: "error", message: "You are not allowed to perform this action." };
  const result = await replyAsStaff(session.user.id, (await panelStore()).id, String(ticketId), formData.get("body"), formData.get("close") === "on");
  if (!result.ok) return { status: "error", message: result.reason === "not-found" ? "This request no longer exists." : "Write a reply of up to 5000 characters." };
  await deliverPendingEmails().catch((error) => console.error("support: customer email failed", error instanceof Error ? error.message : error));
  revalidatePath("/panel/support");
  revalidatePath(`/panel/support/${ticketId}`);
  return { status: "ok", message: "Reply sent." };
}

export async function setTicketStatusAction(ticketId: string, status: "open" | "closed") {
  const { failure } = await requireAdmin();
  if (failure || (status !== "open" && status !== "closed")) return;
  await setTicketStatus((await panelStore()).id, String(ticketId), status);
  revalidatePath("/panel/support");
  revalidatePath(`/panel/support/${ticketId}`);
}
