import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import {
  releaseIsIncluded,
  subscriptionHasAccess,
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
  assert.equal(
    releaseIsIncluded(
      { ...s, status: "expired" },
      { createdAt: new Date("2026-12-01") },
      now,
    ),
    true,
  );
  assert.equal(
    releaseIsIncluded(
      { ...s, status: "expired" },
      { createdAt: new Date("2027-02-01") },
      now,
    ),
    false,
  );
  assert.equal(
    releaseIsIncluded(
      { ...s, status: "refunded" },
      { createdAt: new Date("2026-01-01") },
      now,
    ),
    false,
  );
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
