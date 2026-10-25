import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyCreemSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function subscriptionHasAccess(
  s: { status: string; currentPeriodEnd: Date },
  now = new Date(),
) {
  return (
    ["active", "scheduled_cancel", "trialing"].includes(s.status) &&
    s.currentPeriodEnd > now
  );
}

/** Subscription statuses that take every right away (set locally from refund and dispute events). */
export const REVERSED_STATUSES = ["refunded", "disputed"] as const;

/**
 * The one download rule, for one-time purchases and subscriptions alike: an
 * entitlement that was not revoked covers every release published on or
 * before `updatesUntil` (null = lifetime updates). Releases delivered during
 * a paid term stay downloadable after it ends; only refunds and disputes
 * revoke them.
 */
export function entitlementCovers(
  entitlement: { revokedAt: Date | null; updatesUntil: Date | null },
  release: { createdAt: Date },
) {
  return !entitlement.revokedAt && (entitlement.updatesUntil === null || release.createdAt <= entitlement.updatesUntil);
}

/** Whether the entitlement still receives new releases. */
export function entitlementReceivesUpdates(
  entitlement: { revokedAt: Date | null; updatesUntil: Date | null },
  now = new Date(),
) {
  return !entitlement.revokedAt && (entitlement.updatesUntil === null || entitlement.updatesUntil > now);
}

/** End of the update window a one-time purchase includes; null = lifetime. */
export function updatesUntilForPurchase(updatesMonths: number | null, placedAt: Date): Date | null {
  if (updatesMonths === null) return null;
  const until = new Date(placedAt);
  until.setUTCMonth(until.getUTCMonth() + updatesMonths);
  return until;
}
