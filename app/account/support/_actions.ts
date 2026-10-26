"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { createTicket, replyAsCustomer, type SupportResult } from "@/lib/support";

export type SupportState = { status: "idle" | "error"; message: string };

function failure(result: Exclude<SupportResult, { ok: true }>, l: Awaited<ReturnType<typeof getRequestLocale>>): SupportState {
  return {
    status: "error",
    message:
      result.reason === "rate-limit"
        ? copy(l, "You opened several requests today. Add to an existing one or try again tomorrow.", "Sie haben heute bereits mehrere Anfragen gestellt. Ergänzen Sie eine bestehende oder versuchen Sie es morgen.", "Bugün birkaç talep açtınız. Mevcut bir talebe ekleyin veya yarın tekrar deneyin.")
        : result.reason === "not-found"
          ? copy(l, "This request no longer exists.", "Diese Anfrage existiert nicht mehr.", "Bu talep artık mevcut değil.")
          : copy(l, "Enter a subject (3–120 characters) and a message of at least 10 characters.", "Geben Sie einen Betreff (3–120 Zeichen) und eine Nachricht mit mindestens 10 Zeichen ein.", "Bir konu (3–120 karakter) ve en az 10 karakterlik bir mesaj girin."),
  };
}

export async function createTicketAction(_previous: SupportState, formData: FormData): Promise<SupportState> {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const result = await createTicket(user, storeId, {
    subject: formData.get("subject"),
    body: formData.get("body"),
    productId: formData.get("productId") || undefined,
  });
  if (!result.ok) return failure(result, l);
  revalidatePath("/account/support");
  redirect(`/account/support/${result.data.id}?lang=${l}`);
}

export async function replyTicketAction(ticketId: string, _previous: SupportState, formData: FormData): Promise<SupportState> {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const result = await replyAsCustomer(user, storeId, String(ticketId), formData.get("body"));
  if (!result.ok) return failure(result, l);
  revalidatePath(`/account/support/${ticketId}`);
  return { status: "idle", message: "" };
}
