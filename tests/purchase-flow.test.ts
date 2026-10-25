import { test } from "node:test";
import assert from "node:assert/strict";
import { safePurchaseReturn } from "../lib/purchase-flow";
test("purchase callbacks preserve the selected product and plan but reject external and private destinations", () => {
  assert.equal(
    safePurchaseReturn("/tr/theme/aurelia-stay?plan=plan_1&lang=tr"),
    "/tr/theme/aurelia-stay?plan=plan_1&lang=tr",
  );
  assert.equal(
    safePurchaseReturn(
      "/account/checkout?plan=plan_1&lang=de&redirect=https://evil.test",
    ),
    "/account/checkout?plan=plan_1&lang=de",
  );
  for (const path of [
    "https://evil.test",
    "//evil.test/theme/a",
    "/\\evil.test",
    "/panel",
    "/api/billing/checkout",
    "/tr/theme/%2f%2fevil.test",
    "/auth/sign-in",
    null,
  ])
    assert.equal(safePurchaseReturn(path), null);
});
