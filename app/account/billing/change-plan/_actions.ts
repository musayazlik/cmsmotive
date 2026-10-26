"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/customer-auth";
import { upgradeSubscription } from "@/lib/customer-billing";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";

export type PlanState = { status: "idle" | "error"; message: string };

/** Moves the customer's subscription to the chosen bigger plan (prorated difference charged now). */
export async function changePlanAction(_previous: PlanState, formData: FormData): Promise<PlanState> {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  if (formData.get("confirm") !== "on")
    return { status: "error", message: copy(l, "Confirm the charge for the new plan.", "Bestätigen Sie die Abbuchung für den neuen Tarif.", "Yeni plan için yapılacak tahsilatı onaylayın.") };
  const result = await upgradeSubscription(user.id, String(formData.get("subscription") ?? ""), String(formData.get("price") ?? ""));
  if (!result.ok)
    return {
      status: "error",
      message:
        result.reason === "provider"
          ? copy(l, "Creem could not change the plan. Nothing was charged; try again later.", "Creem konnte den Tarif nicht ändern. Es wurde nichts abgebucht; versuchen Sie es später erneut.", "Creem planı değiştiremedi. Ücret alınmadı; daha sonra tekrar deneyin.")
          : copy(l, "This plan is not available for your subscription.", "Dieser Tarif ist für Ihr Abonnement nicht verfügbar.", "Bu plan aboneliğiniz için uygun değil."),
    };
  revalidatePath("/account", "layout");
  redirect(`/account/billing?lang=${l}&plan=changed`);
}
