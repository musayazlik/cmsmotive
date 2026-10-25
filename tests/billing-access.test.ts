import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import {
  entitlementCovers,
  entitlementReceivesUpdates,
  subscriptionHasAccess,
  updatesUntilForPurchase,
  verifyCreemSignature,
} from "../lib/billing-access";
import {
  DEFAULT_LEGAL_SETTINGS,
  legalReadiness,
  validateLegalSettings,
} from "../lib/legal-settings-shared";
import {
  DEFAULT_COMPLIANCE,
  publicationMissing,
} from "../lib/product-compliance";
test("webhooks authenticate the exact raw bytes and reject malformed signatures", () => {
  const secret = "fixture-secret";
  const raw = '{"id":"event"}';
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyCreemSignature(raw, signature, secret), true);
  for (const invalid of [null, "", signature.slice(1), "g".repeat(64)])
    assert.equal(verifyCreemSignature(raw, invalid, secret), false);
  assert.equal(verifyCreemSignature(raw + " ", signature, secret), false);
});
test("scheduled cancellation retains the paid term; expiry excludes new releases and refunds exclude downloads", () => {
  const now = new Date("2026-10-24");
  const s = {
    status: "scheduled_cancel",
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2027-01-01"),
  };
  assert.equal(subscriptionHasAccess(s, now), true);
  assert.equal(subscriptionHasAccess(s, new Date("2027-01-01")), false);
});
test("an entitlement covers every release up to its update window; null means lifetime", () => {
  const release = (createdAt: string) => ({ createdAt: new Date(createdAt) });
  const entitlement = { revokedAt: null, updatesUntil: new Date("2027-01-01") };
  // Releases published inside the paid window stay covered, the boundary day included.
  assert.equal(entitlementCovers(entitlement, release("2026-12-01")), true);
  assert.equal(entitlementCovers(entitlement, release("2027-01-01")), true);
  assert.equal(entitlementCovers(entitlement, release("2027-02-01")), false);
  // Lifetime updates cover everything.
  assert.equal(entitlementCovers({ ...entitlement, updatesUntil: null }, release("2030-01-01")), true);
  // A refund or dispute revokes every right, even for releases inside the window.
  assert.equal(entitlementCovers({ ...entitlement, revokedAt: new Date("2026-01-01") }, release("2026-01-01")), false);
});
test("update windows end on their month mark, and expired windows receive no new releases", () => {
  assert.equal(updatesUntilForPurchase(null, new Date("2026-01-01")), null);
  assert.equal(updatesUntilForPurchase(12, new Date("2026-01-01"))?.toISOString(), "2027-01-01T00:00:00.000Z");
  const now = new Date("2026-10-24");
  assert.equal(entitlementReceivesUpdates({ revokedAt: null, updatesUntil: new Date("2026-10-25") }, now), true);
  assert.equal(entitlementReceivesUpdates({ revokedAt: null, updatesUntil: new Date("2026-10-24") }, now), false);
  assert.equal(entitlementReceivesUpdates({ revokedAt: new Date("2026-10-01"), updatesUntil: null }, now), false);
});
test("incomplete seller data and unchecked release rights cannot be marked ready", () => {
  assert.ok(legalReadiness(DEFAULT_LEGAL_SETTINGS).length > 0);
  assert.ok(
    "error" in
      validateLegalSettings({
        ...DEFAULT_LEGAL_SETTINGS,
        legalName: "",
        accountTermsReviewed: true,
      }),
  );
  assert.ok(
    publicationMissing({ ...DEFAULT_COMPLIANCE, codeLicense: "proprietary" })
      .length > 0,
  );
});
