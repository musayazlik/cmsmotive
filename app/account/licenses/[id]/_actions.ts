"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer-auth";
import { deactivateLicenseInstance } from "@/lib/customer-billing";

/** Releases one installation of the customer's licence key so it can be used elsewhere. */
export async function deactivateInstanceAction(licenseKeyId: string, instanceId: string): Promise<boolean> {
  const user = await requireCustomer();
  const done = await deactivateLicenseInstance(user.id, String(licenseKeyId), String(instanceId));
  if (done) revalidatePath(`/account/licenses/${licenseKeyId}`);
  return done;
}
