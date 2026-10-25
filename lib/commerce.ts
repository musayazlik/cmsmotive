import type { Prisma } from "@/generated/prisma/client";
import { REVERSED_STATUSES, updatesUntilForPurchase } from "@/lib/billing-access";
import {
  checkoutSchema,
  creemMode,
  creemRequest,
  objectId,
  searchTransactions,
  subscriptionSchema,
  type CreemCheckout,
  type CreemSubscription,
  type CreemTransaction,
} from "@/lib/creem";
import { prisma } from "@/lib/prisma";

/**
 * Turns Creem webhook events into local commerce records. Every handler first
 * reads the authoritative object from the Creem API (never trusting arrival
 * order or the success page), then writes inside one transaction that is
 * locked per Creem object and records the event id, so retries and duplicate
 * deliveries never grant twice.
 *
 * Results: "done" (recorded), "ignored" (not ours, nothing to do), or a
 * client error the route returns without recording, so Creem retries.
 */
export type SyncResult = { status: "done" | "ignored" } | { status: "rejected"; code: number; message: string };

type Tx = Prisma.TransactionClient;
type EventRef = { id: string; type: string };

const done: SyncResult = { status: "done" };
const ignored: SyncResult = { status: "ignored" };
const rejected = (code: number, message: string): SyncResult => ({ status: "rejected", code, message });

const ref = (value: unknown): string | null =>
  typeof value === "string" ? value : value && typeof value === "object" && "id" in value ? String(value.id) : null;

async function lockedOnce(key: string, event: EventRef, mode: string, write: (tx: Tx) => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
    await write(tx);
    await tx.paymentEvent.create({ data: { id: event.id, type: event.type, mode } });
  });
}

async function findAttempt(metadata: Record<string, unknown> | null | undefined, requestId?: string | null) {
  const id = typeof metadata?.checkoutAttemptId === "string" ? metadata.checkoutAttemptId : requestId;
  return id ? prisma.checkoutAttempt.findUnique({ where: { id }, include: { price: true } }) : null;
}

/** The store's customer row for a Creem customer, linked to the buyer's account. */
async function upsertCustomer(
  tx: Tx,
  input: { storeId: string; mode: string; creemCustomerId: string; userId: string | null; email?: string | null; name?: string | null; country?: string | null },
) {
  const user = input.userId ? await tx.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } }) : null;
  const email = input.email || user?.email || "";
  return tx.customer.upsert({
    where: { storeId_creemCustomerId: { storeId: input.storeId, creemCustomerId: input.creemCustomerId } },
    create: {
      storeId: input.storeId, mode: input.mode, creemCustomerId: input.creemCustomerId, userId: input.userId,
      email, name: input.name ?? user?.name ?? null, country: input.country ?? null,
    },
    update: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(email ? { email } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.country ? { country: input.country } : {}),
    },
  });
}

/** Mirrors Creem transactions (the panel's invoices); later Creem values win. */
async function upsertTransactions(
  tx: Tx,
  items: CreemTransaction[],
  owner: { storeId: string; customerId: string; orderId?: string | null; subscriptionId?: string | null },
) {
  for (const item of items) {
    const data = {
      mode: item.mode, type: item.type, status: item.status, amountCents: item.amount,
      amountPaidCents: item.amount_paid ?? null, taxCents: item.tax_amount ?? null,
      discountCents: item.discount_amount ?? null, refundedCents: item.refunded_amount ?? null,
      currency: item.currency, taxCountry: item.tax_country ?? null, description: item.description ?? null,
      periodStart: item.period_start ?? null, periodEnd: item.period_end ?? null, occurredAt: item.created_at,
    };
    await tx.transaction.upsert({
      where: { creemTransactionId: item.id },
      create: {
        ...data, creemTransactionId: item.id, storeId: owner.storeId, customerId: owner.customerId,
        orderId: owner.orderId ?? null, subscriptionId: owner.subscriptionId ?? null,
      },
      update: { ...data, ...(owner.orderId ? { orderId: owner.orderId } : {}), ...(owner.subscriptionId ? { subscriptionId: owner.subscriptionId } : {}) },
    });
  }
}

/**
 * Writes a reconciled subscription and the entitlement it grants. A newer
 * Creem state always wins; on equal timestamps a local refund or dispute is
 * kept, so a late duplicate cannot undo it.
 */
async function writeSubscription(
  tx: Tx,
  s: CreemSubscription,
  owner: { storeId: string; customerId: string; productId: string; priceId: string; seats: number },
  status = s.status,
) {
  const providerUpdatedAt = new Date(s.updated_at);
  const current = await tx.subscription.findUnique({ where: { creemSubscriptionId: s.id } });
  const newer =
    !current ||
    current.providerUpdatedAt < providerUpdatedAt ||
    (current.providerUpdatedAt.getTime() === providerUpdatedAt.getTime() &&
      (!(REVERSED_STATUSES as readonly string[]).includes(current.status) || (REVERSED_STATUSES as readonly string[]).includes(status)));
  if (!newer) return current!;

  const data = {
    storeId: owner.storeId, customerId: owner.customerId, productId: owner.productId, priceId: owner.priceId,
    mode: s.mode, status, currentPeriodStart: new Date(s.current_period_start_date),
    currentPeriodEnd: new Date(s.current_period_end_date), canceledAt: s.canceled_at ? new Date(s.canceled_at) : null, providerUpdatedAt,
  };
  const row = await tx.subscription.upsert({ where: { creemSubscriptionId: s.id }, create: { ...data, creemSubscriptionId: s.id }, update: data });

  const reversed = (REVERSED_STATUSES as readonly string[]).includes(status);
  const existing = await tx.entitlement.findUnique({ where: { subscriptionId: row.id } });
  const rights = {
    updatesUntil: row.currentPeriodEnd,
    seats: owner.seats,
    revokedAt: reversed ? (existing?.revokedAt ?? new Date()) : null,
    revokeReason: reversed ? (status === "refunded" ? "refund" : "dispute") : null,
  };
  await tx.entitlement.upsert({
    where: { subscriptionId: row.id },
    create: { ...rights, storeId: owner.storeId, customerId: owner.customerId, productId: owner.productId, subscriptionId: row.id },
    update: rights,
  });
  return row;
}

async function fetchSubscription(id: string) {
  return subscriptionSchema.parse(await creemRequest(`/v1/subscriptions?subscription_id=${encodeURIComponent(id)}`));
}

/* ------------------------------------------------------------ checkout.completed */

/** A completed checkout: the order, the customer, and the rights it grants (one-time or the subscription's first period). */
export async function syncCheckout(event: EventRef, object: Record<string, unknown>): Promise<SyncResult> {
  const checkoutId = ref(object);
  if (!checkoutId) return ignored;
  const checkout: CreemCheckout = checkoutSchema.parse(await creemRequest(`/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`));
  if (checkout.mode !== creemMode()) return rejected(400, "Wrong payment environment");
  const attempt = await findAttempt(checkout.metadata, checkout.request_id);
  if (!attempt) return ignored;
  const order = checkout.order;
  if (attempt.creemProductId !== objectId(order.product) || attempt.mode !== checkout.mode) return rejected(400, "Product mismatch");

  const subscriptionId = ref(checkout.subscription);
  const subscription = subscriptionId ? await fetchSubscription(subscriptionId) : null;
  const transactions = await searchTransactions({ order_id: order.id }, 1);
  const price = attempt.price;
  const buyer = typeof checkout.customer === "string" ? { id: checkout.customer } : checkout.customer;

  await lockedOnce(order.id, event, checkout.mode, async (tx) => {
    const customer = await upsertCustomer(tx, {
      storeId: attempt.storeId, mode: checkout.mode, creemCustomerId: buyer.id, userId: attempt.userId,
      email: "email" in buyer ? buyer.email : null, name: "name" in buyer ? buyer.name : null, country: "country" in buyer ? buyer.country : null,
    });
    const owner = { storeId: attempt.storeId, customerId: customer.id, productId: price.productId, priceId: price.id, seats: price.seats };
    const subscriptionRow = subscription ? await writeSubscription(tx, subscription, owner) : null;

    const orderData = {
      status: order.status, amountCents: order.amount, currency: order.currency, mode: order.mode,
      subscriptionId: subscriptionRow?.id ?? null, creemCheckoutId: checkout.id,
    };
    const orderRow = await tx.order.upsert({
      where: { creemOrderId: order.id },
      create: {
        ...orderData, creemOrderId: order.id, storeId: attempt.storeId, customerId: customer.id, productId: price.productId,
        priceId: price.id, checkoutAttemptId: attempt.id, type: subscription ? "recurring" : "onetime", placedAt: new Date(order.created_at),
      },
      update: orderData,
    });

    // A one-time purchase grants its own entitlement; a subscription's comes from writeSubscription.
    const entitlement = subscriptionRow
      ? await tx.entitlement.findUnique({ where: { subscriptionId: subscriptionRow.id } })
      : await tx.entitlement.upsert({
          where: { orderId: orderRow.id },
          create: {
            storeId: attempt.storeId, customerId: customer.id, productId: price.productId, orderId: orderRow.id, seats: price.seats,
            updatesUntil: updatesUntilForPurchase(price.updatesMonths, orderRow.placedAt),
          },
          update: {},
        });

    if (entitlement) {
      for (const key of checkout.license_keys ?? []) {
        const data = {
          key: key.key, status: key.status, activations: key.activation, activationLimit: key.activation_limit ?? null,
          expiresAt: key.expires_at ? new Date(key.expires_at) : null, mode: key.mode,
        };
        await tx.licenseKey.upsert({
          where: { creemLicenseId: key.id },
          create: { ...data, creemLicenseId: key.id, entitlementId: entitlement.id },
          update: data,
        });
      }
    }
    await upsertTransactions(tx, transactions, { storeId: attempt.storeId, customerId: customer.id, orderId: orderRow.id, subscriptionId: subscriptionRow?.id });
  });
  return done;
}

/* ------------------------------------------------------------- subscription.* */

/** Any subscription event: reconcile the subscription; renewals also record their transactions. */
export async function syncSubscription(event: EventRef, subscriptionId: string): Promise<SyncResult> {
  const s = await fetchSubscription(subscriptionId);
  if (s.mode !== creemMode()) return rejected(400, "Wrong payment environment");
  const local = await prisma.subscription.findUnique({ where: { creemSubscriptionId: s.id }, include: { price: true } });
  const attempt = local ? null : await findAttempt(s.metadata);
  if (!local && !attempt) return ignored;
  if (attempt && (attempt.creemProductId !== objectId(s.product) || attempt.mode !== s.mode)) return rejected(400, "Product mismatch");
  const price = local?.price ?? attempt!.price;
  const storeId = local?.storeId ?? attempt!.storeId;

  const renewal = event.type === "subscription.paid";
  const transactions = renewal
    ? (await searchTransactions({ customer_id: objectId(s.customer), product_id: objectId(s.product) }, 1)).filter((item) => item.subscription === s.id)
    : [];

  await lockedOnce(s.id, event, s.mode, async (tx) => {
    const customerId =
      local?.customerId ??
      (await upsertCustomer(tx, { storeId, mode: s.mode, creemCustomerId: objectId(s.customer), userId: attempt!.userId })).id;
    const row = await writeSubscription(tx, s, { storeId, customerId, productId: price.productId, priceId: price.id, seats: price.seats });
    await upsertTransactions(tx, transactions, { storeId, customerId, subscriptionId: row.id });
  });
  return done;
}

/* --------------------------------------------------- refund.created, dispute.created */

/**
 * A refund or chargeback. On a subscription it only counts when it reverses
 * the latest payment (an old renewal's refund leaves the current term
 * intact); on a one-time order a full refund or any dispute revokes the
 * purchase, a partial refund only marks the order.
 */
export async function syncReversal(event: EventRef, object: Record<string, unknown>): Promise<SyncResult> {
  const dispute = event.type === "dispute.created";
  const transaction = (object.transaction && typeof object.transaction === "object" ? object.transaction : {}) as Record<string, unknown>;
  const transactionId = ref(transaction);
  const subscriptionId = ref(object.subscription) ?? ref(transaction.subscription);

  if (subscriptionId?.startsWith("sub_")) {
    const s = await fetchSubscription(subscriptionId);
    if (s.mode !== creemMode()) return rejected(400, "Wrong payment environment");
    const local = await prisma.subscription.findUnique({ where: { creemSubscriptionId: s.id }, include: { price: true } });
    if (!local) return ignored;
    const latest = Boolean(transactionId) && transactionId === s.last_transaction_id;
    const fullRefund = transaction.status === "refunded";
    const status = latest && dispute ? "disputed" : latest && fullRefund ? "refunded" : s.status;
    await lockedOnce(s.id, event, s.mode, async (tx) => {
      await writeSubscription(
        tx, s,
        { storeId: local.storeId, customerId: local.customerId, productId: local.productId, priceId: local.priceId, seats: local.price.seats },
        status,
      );
    });
    return done;
  }

  const orderId = ref(object.order) ?? (typeof transaction.order === "string" ? transaction.order : null);
  if (!orderId) return ignored;
  const order = await prisma.order.findUnique({ where: { creemOrderId: orderId } });
  if (!order) return ignored;
  if (order.mode !== creemMode()) return rejected(400, "Wrong payment environment");
  // The order's transactions from the API are the authority on how much was refunded.
  const transactions = await searchTransactions({ order_id: orderId }, 1);
  const paid = transactions.reduce((sum, item) => sum + (item.amount_paid ?? item.amount), 0);
  const refunded = transactions.reduce((sum, item) => sum + (item.refunded_amount ?? 0), 0);
  const status = dispute ? "disputed" : refunded > 0 && refunded >= paid ? "refunded" : refunded > 0 ? "partially_refunded" : order.status;

  await lockedOnce(orderId, event, order.mode, async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status } });
    if (status === "refunded" || status === "disputed") {
      await tx.entitlement.updateMany({
        where: { orderId: order.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: dispute ? "dispute" : "refund" },
      });
    }
    await upsertTransactions(tx, transactions, { storeId: order.storeId, customerId: order.customerId, orderId: order.id });
  });
  return done;
}
