"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { setAccountLocale, setNewsletter } from "@/lib/account-preferences";
import { isLocale } from "@/lib/i18n/config";
import { getLegalSettings } from "@/lib/legal";
import { markNotificationsRead, saveNotificationPreferences } from "@/lib/notifications";

const ids = z.array(z.string().min(1).max(64)).max(100);

/** Marks the given messages read, or every message of the customer in this store when none are given. */
export async function markNotificationsReadAction(input?: string[]) {
  const user = await requireCustomer();
  const parsed = input === undefined ? { success: true as const, data: undefined } : ids.safeParse(input);
  if (!parsed.success) return;
  await markNotificationsRead(user.id, await currentStoreId(), parsed.data);
  revalidatePath("/account", "layout");
}

/** Mail categories, mail language and the store newsletter, saved together from one form. */
export async function saveNotificationPreferencesAction(formData: FormData) {
  const user = await requireCustomer();
  const storeId = await currentStoreId();
  await saveNotificationPreferences(user.id, {
    emailReleases: formData.get("emailReleases") === "on",
    emailBilling: formData.get("emailBilling") === "on",
  });
  const locale = String(formData.get("accountLocale") ?? "");
  if (isLocale(locale)) await setAccountLocale(user.id, locale);
  const legal = await getLegalSettings(storeId);
  // The privacy notice version shown next to the checkbox is the consent recorded with the sign-up.
  if (formData.get("privacyVersion") === legal.privacyVersion || formData.get("newsletter") !== "on") {
    await setNewsletter(storeId, user, formData.get("newsletter") === "on", {
      locale: isLocale(locale) ? locale : isLocale(user.accountLocale) ? user.accountLocale : "en",
      privacyVersion: legal.privacyVersion,
    });
  }
  revalidatePath("/account/notifications");
}
