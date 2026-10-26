import { randomUUID } from "node:crypto";
import { z } from "zod";
import { syncSubscription } from "./commerce";
import { creemMode, creemRequest } from "./creem";
import { prisma } from "./prisma";

/**
 * Self-service changes a customer makes to what they bought: moving a
 * subscription to a bigger plan and releasing licence installations. Every
 * function takes the signed-in user and only touches records whose customer
 * belongs to that user in the current payment environment.
 */

const UPGRADABLE = ["active", "trialing"];

const creemProductOf = (price: { creemTestProductId: string | null; creemLiveProductId: string | null }) =>
  creemMode() === "prod" ? price.creemLiveProductId : price.creemTestProductId;

/** A running subscription of the user and the plans it can move up to (same product and interval, higher price or more installations). */
export async function loadUpgradeOptions(userId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, mode: creemMode(), customer: { userId } },
    include: { price: true, product: { select: { name: true } } },
  });
  if (!subscription) return null;
  const options = UPGRADABLE.includes(subscription.status)
    ? (
        await prisma.price.findMany({
          where: {
            productId: subscription.productId,
            billingType: "recurring",
            interval: subscription.price.interval,
            enabled: true,
            id: { not: subscription.priceId },
          },
          orderBy: [{ amountCents: "asc" }, { position: "asc" }],
        })
      ).filter(
        (price) =>
          creemProductOf(price) &&
          price.currency === subscription.price.currency &&
          (price.amountCents > subscription.price.amountCents || price.seats > subscription.price.seats),
      )
    : [];
  return { subscription, options };
}

export type UpgradeResult = { ok: true } | { ok: false; reason: "not-found" | "not-allowed" | "provider" };

/**
 * Moves the subscription to another plan through Creem, charging the prorated
 * difference immediately, then reconciles it at once so the account shows the
 * new plan without waiting for the webhook (which repeats the same write).
 */
export async function upgradeSubscription(userId: string, subscriptionId: string, priceId: string): Promise<UpgradeResult> {
  const loaded = await loadUpgradeOptions(userId, subscriptionId);
  if (!loaded) return { ok: false, reason: "not-found" };
  const target = loaded.options.find((option) => option.id === priceId);
  const productId = target && creemProductOf(target);
  if (!target || !productId) return { ok: false, reason: "not-allowed" };
  try {
    await creemRequest(`/v1/subscriptions/${encodeURIComponent(loaded.subscription.creemSubscriptionId)}/upgrade`, {
      product_id: productId,
      update_behavior: "proration-charge-immediately",
    });
  } catch (error) {
    console.error("subscription upgrade failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: "provider" };
  }
  try {
    await syncSubscription({ id: `account-upgrade:${randomUUID()}`, type: "subscription.update" }, loaded.subscription.creemSubscriptionId);
  } catch (error) {
    // Creem accepted the change; its webhook brings the local record up to date.
    console.error("subscription upgrade: local sync deferred to webhook", error instanceof Error ? error.message : error);
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ licences */

const instanceSchema = z.object({ id: z.string(), name: z.string().nullish(), status: z.string(), created_at: z.string() }).passthrough();

/** A Creem licence key of the user and its installations (instances), straight from Creem. */
export async function loadLicenseInstances(userId: string, licenseKeyId: string) {
  const license = await prisma.licenseKey.findFirst({
    where: { id: licenseKeyId, creemLicenseId: { not: null }, entitlement: { revokedAt: null, customer: { userId, mode: creemMode() } } },
    include: { entitlement: { select: { product: { select: { name: true } } } } },
  });
  if (!license?.creemLicenseId) return null;
  const instances: z.infer<typeof instanceSchema>[] = [];
  let failed = false;
  try {
    for (let page = 1; page <= 5; page++) {
      const result = await creemRequest(`/v1/licenses/${encodeURIComponent(license.creemLicenseId)}/instances?page_number=${page}&page_size=50`);
      for (const item of Array.isArray(result.items) ? result.items : []) {
        const parsed = instanceSchema.safeParse(item);
        if (parsed.success) instances.push(parsed.data);
      }
      if (!(result.pagination as { next_page?: number | null } | undefined)?.next_page) break;
    }
  } catch (error) {
    console.error("licence instances unavailable", error instanceof Error ? error.message : error);
    failed = true;
  }
  return { license, instances, failed };
}

/** Releases one installation of the user's Creem licence key and stores Creem's new activation count. */
export async function deactivateLicenseInstance(userId: string, licenseKeyId: string, instanceId: string): Promise<boolean> {
  const loaded = await loadLicenseInstances(userId, licenseKeyId);
  if (!loaded || !loaded.instances.some((instance) => instance.id === instanceId && instance.status === "active")) return false;
  try {
    const result = await creemRequest("/v1/licenses/deactivate", { key: loaded.license.key, instance_id: instanceId });
    const activations = typeof result.activation === "number" ? result.activation : null;
    await prisma.licenseKey.update({
      where: { id: loaded.license.id },
      data: { ...(activations !== null ? { activations } : {}), ...(typeof result.status === "string" ? { status: result.status } : {}) },
    });
    return true;
  } catch (error) {
    console.error("licence deactivation failed", error instanceof Error ? error.message : error);
    return false;
  }
}
