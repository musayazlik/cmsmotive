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
    ["active", "scheduled_cancel"].includes(s.status) &&
    s.currentPeriodEnd > now
  );
}
export function releaseIsIncluded(
  s: { status: string; currentPeriodStart: Date; currentPeriodEnd: Date },
  release: { createdAt: Date },
  now = new Date(),
) {
  // Retain downloads of versions delivered during the paid term; expiry only stops new releases and support.
  return (
    (subscriptionHasAccess(s, now) ||
      ["canceled", "expired", "past_due", "unpaid"].includes(s.status)) &&
    release.createdAt <= s.currentPeriodEnd
  );
}
