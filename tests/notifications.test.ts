import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NOTIFICATION_TYPES,
  notificationCategory,
  presentNotifications,
  relativeTime,
  renderNotification,
  subscriptionTransition,
} from "../lib/notification-text";

const period = (iso: string) => new Date(iso);

test("every notification type renders a title and body in all three languages", () => {
  for (const type of NOTIFICATION_TYPES)
    for (const l of ["en", "de", "tr"] as const) {
      const { title, body } = renderNotification(
        type,
        { product: "Aurelia", plan: "Agency", version: "1.4.0", date: "2027-03-01T00:00:00.000Z", amountCents: 14900, currency: "EUR" },
        l,
      );
      assert.ok(title.length > 3, `${type}/${l} title`);
      assert.ok(body.includes("Aurelia"), `${type}/${l} names the product`);
      assert.ok(!/undefined|NaN|\{|\}/.test(title + body), `${type}/${l} has no placeholder leftovers`);
    }
});

test("a renewal reminder names the date and the amount that will be charged", () => {
  const en = renderNotification(
    "subscription.renewal_upcoming",
    { product: "Aurelia", plan: "Agency", date: "2027-03-01T00:00:00.000Z", amountCents: 14900, currency: "EUR" },
    "en",
  );
  assert.match(en.body, /March 1, 2027/);
  assert.match(en.body, /€149/);
  const tr = renderNotification("subscription.renewal_upcoming", { product: "Aurelia", date: "2027-03-01T00:00:00.000Z" }, "tr");
  assert.match(tr.body, /1 Mart 2027/);
  assert.ok(!tr.body.includes("tahsil"), "no charge sentence without an amount");
});

test("a release title carries the version when there is one", () => {
  assert.equal(renderNotification("release.published", { product: "Aurelia", version: "2.0.0" }, "en").title, "Aurelia 2.0.0 is available");
  assert.equal(renderNotification("release.published", { product: "Aurelia" }, "en").title, "Aurelia is available");
});

test("only failed payments and support replies bypass the email opt-out", () => {
  assert.equal(notificationCategory("subscription.payment_failed"), "critical");
  assert.equal(notificationCategory("support.replied"), "critical");
  assert.equal(notificationCategory("release.published"), "releases");
  for (const type of NOTIFICATION_TYPES.filter((type) => !["subscription.payment_failed", "support.replied", "release.published"].includes(type)))
    assert.equal(notificationCategory(type), "billing", type);
});

test("subscription changes map to one message, and a repeated event to none", () => {
  const before = { status: "active", currentPeriodEnd: period("2026-10-26") };
  assert.equal(subscriptionTransition(before, { status: "active", currentPeriodEnd: period("2027-10-26") }), "subscription.renewed");
  assert.equal(subscriptionTransition(before, { ...before }), null);
  assert.equal(subscriptionTransition(before, { status: "past_due", currentPeriodEnd: before.currentPeriodEnd }), "subscription.payment_failed");
  assert.equal(subscriptionTransition(before, { status: "unpaid", currentPeriodEnd: before.currentPeriodEnd }), "subscription.payment_failed");
  assert.equal(subscriptionTransition(before, { status: "scheduled_cancel", currentPeriodEnd: before.currentPeriodEnd }), "subscription.cancel_scheduled");
  assert.equal(subscriptionTransition({ ...before, status: "scheduled_cancel" }, { status: "expired", currentPeriodEnd: before.currentPeriodEnd }), "subscription.ended");
  // Recovering from a failed payment moves the period forward: that is a renewal, not silence.
  assert.equal(
    subscriptionTransition({ ...before, status: "past_due" }, { status: "active", currentPeriodEnd: period("2027-10-26") }),
    "subscription.renewed",
  );
  // Reactivation without a new period (status only) has nothing to announce.
  assert.equal(subscriptionTransition({ ...before, status: "paused" }, { status: "active", currentPeriodEnd: before.currentPeriodEnd }), null);
});

test("stored notifications are presented in the reader's language and unknown types are dropped", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const rows = [
    { id: "a", type: "release.published", data: { product: "Aurelia", version: "1.1.0" }, href: null, readAt: null, createdAt: new Date("2026-10-26T11:00:00Z") },
    { id: "b", type: "from.a.newer.deploy", data: {}, href: null, readAt: null, createdAt: now },
    { id: "c", type: "purchase.confirmed", data: { product: "Forma" }, href: "/account/products", readAt: now, createdAt: new Date("2026-10-20T00:00:00Z") },
  ];
  const presented = presentNotifications(rows, "de", now);
  assert.deepEqual(presented.map((item) => item.id), ["a", "c"]);
  assert.equal(presented[0].title, "Aurelia 1.1.0 ist verfügbar");
  assert.equal(presented[0].href, "/account/downloads");
  assert.equal(presented[0].read, false);
  assert.equal(presented[1].read, true);
});

test("relative times are short and fall back to a date after a week", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(relativeTime(new Date("2026-10-26T11:59:40Z"), now, "en"), "just now");
  assert.match(relativeTime(new Date("2026-10-26T11:15:00Z"), now, "en"), /45 min/);
  assert.match(relativeTime(new Date("2026-10-26T09:00:00Z"), now, "en"), /3 hr/);
  assert.match(relativeTime(new Date("2026-10-01T09:00:00Z"), now, "en"), /Oct 1, 2026/);
});
