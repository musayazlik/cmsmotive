"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
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

export async function saveNotificationPreferencesAction(formData: FormData) {
  const user = await requireCustomer();
  await saveNotificationPreferences(user.id, {
    emailReleases: formData.get("emailReleases") === "on",
    emailBilling: formData.get("emailBilling") === "on",
  });
  revalidatePath("/account/notifications");
}
