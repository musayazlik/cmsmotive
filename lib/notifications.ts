import type { Prisma } from "@/generated/prisma/client";
import { copy } from "./legal-copy";
import { isLocale, type Locale } from "./i18n/config";
import {
  REMINDER_DAYS,
  UPDATES_REMINDER_DAYS,
  isNotificationType,
  notificationCategory,
  notificationHref,
  renderNotification,
  type NotificationData,
  type NotificationType,
} from "./notification-text";
import { isPlunkConfigured, sendCustomerNotificationEmail } from "./plunk";
import { prisma } from "./prisma";

/**
 * Customer notifications. Three producers feed one table:
 *  - webhook handlers (lib/commerce.ts) for purchases, renewals and payment problems,
 *  - announceRelease for a new version, to every buyer whose update window covers it,
 *  - queueReminders for dated reminders (renewal in 3 days, access ending, updates ending).
 * Each notification has a dedupe key, so repeated webhooks, retries and
 * overlapping scheduled runs never message anyone twice. Mail is sent
 * separately by deliverPendingEmails and respects the customer's preferences.
 */

type Db = Prisma.TransactionClient;

export type NewNotification = {
  storeId: string;
  userId: string;
  type: NotificationType;
  data: NotificationData;
  dedupeKey: string;
  /** Overrides the type's default account path, e.g. one support request. */
  href?: string;
};

const DAY = 86_400_000;
const MAX_EMAIL_ATTEMPTS = 3;
/** A message older than this is no longer worth mailing (mail was off, or the job was down). */
const EMAIL_MAX_AGE = 7 * DAY;
/** A claimed mail that never finished (crash mid-send) is retried after this long. */
const EMAIL_CLAIM_TIMEOUT = 15 * 60_000;

/** Inserts the messages, ignoring any whose dedupe key already exists for that user. Returns how many are new. */
export async function createNotifications(db: Db, items: NewNotification[]): Promise<number> {
  if (!items.length) return 0;
  // A deleted account must not fail the caller's transaction (webhooks write inside one).
  const known = new Set((await db.user.findMany({ where: { id: { in: [...new Set(items.map((item) => item.userId))] } }, select: { id: true } })).map((user) => user.id));
  items = items.filter((item) => known.has(item.userId));
  if (!items.length) return 0;
  const { count } = await db.notification.createMany({
    data: items.map((item) => ({
      storeId: item.storeId,
      userId: item.userId,
      type: item.type,
      data: item.data as Prisma.InputJsonObject,
      href: item.href ?? notificationHref(item.type),
      dedupeKey: item.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return count;
}

/* ------------------------------------------------------------------ releases */

/**
 * Tells every buyer whose update window covers a release about it, once. The
 * release is claimed first, so two callers (the upload and the scheduled job)
 * cannot both fan out; a failed fan-out releases the claim for a retry.
 */
export async function announceRelease(releaseId: string): Promise<number> {
  const release = await prisma.productRelease.findUnique({
    where: { id: releaseId },
    select: { id: true, version: true, createdAt: true, notifiedAt: true, product: { select: { id: true, name: true, storeId: true } } },
  });
  if (!release || release.notifiedAt) return 0;
  const claim = await prisma.productRelease.updateMany({ where: { id: release.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (!claim.count) return 0;
  try {
    const entitlements = await prisma.entitlement.findMany({
      where: {
        productId: release.product.id,
        revokedAt: null,
        OR: [{ updatesUntil: null }, { updatesUntil: { gt: release.createdAt } }],
        customer: { userId: { not: null } },
      },
      select: { storeId: true, customer: { select: { userId: true } } },
    });
    const recipients = new Map<string, string>();
    for (const entitlement of entitlements) if (entitlement.customer.userId) recipients.set(entitlement.customer.userId, entitlement.storeId);
    return await createNotifications(
      prisma,
      [...recipients].map(([userId, storeId]) => ({
        storeId,
        userId,
        type: "release.published" as const,
        dedupeKey: `release:${release.id}`,
        data: { product: release.product.name, version: release.version },
      })),
    );
  } catch (error) {
    await prisma.productRelease.updateMany({ where: { id: release.id }, data: { notifiedAt: null } });
    throw error;
  }
}

/** Releases nobody was told about yet (the upload path failed, or the job was down). */
export async function announcePendingReleases(): Promise<number> {
  const pending = await prisma.productRelease.findMany({ where: { notifiedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true }, take: 50 });
  let created = 0;
  for (const { id } of pending) created += await announceRelease(id);
  return created;
}

/* ------------------------------------------------------------------ reminders */

/**
 * Dated reminders, safe to run as often as wanted: a subscription renewing
 * within REMINDER_DAYS, one that is set to end within REMINDER_DAYS, and a
 * one-time purchase whose update window closes within UPDATES_REMINDER_DAYS.
 */
export async function queueReminders(now = new Date()): Promise<number> {
  const within = (days: number) => ({ gt: now, lte: new Date(now.getTime() + days * DAY) });
  const items: NewNotification[] = [];

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ["active", "trialing", "scheduled_cancel"] },
      currentPeriodEnd: within(REMINDER_DAYS),
      customer: { userId: { not: null } },
    },
    select: {
      id: true,
      storeId: true,
      status: true,
      currentPeriodEnd: true,
      customer: { select: { userId: true } },
      product: { select: { name: true } },
      price: { select: { name: true, amountCents: true, currency: true } },
    },
  });
  for (const subscription of subscriptions) {
    const userId = subscription.customer.userId;
    if (!userId) continue;
    const ending = subscription.status === "scheduled_cancel";
    const type = ending ? "subscription.ending_soon" : "subscription.renewal_upcoming";
    items.push({
      storeId: subscription.storeId,
      userId,
      type,
      dedupeKey: `${type}:${subscription.id}:${subscription.currentPeriodEnd.getTime()}`,
      data: {
        product: subscription.product.name,
        plan: subscription.price.name,
        date: subscription.currentPeriodEnd.toISOString(),
        ...(ending ? {} : { amountCents: subscription.price.amountCents, currency: subscription.price.currency }),
      },
    });
  }

  const entitlements = await prisma.entitlement.findMany({
    where: { orderId: { not: null }, revokedAt: null, updatesUntil: within(UPDATES_REMINDER_DAYS), customer: { userId: { not: null } } },
    select: {
      id: true,
      storeId: true,
      updatesUntil: true,
      customer: { select: { userId: true } },
      product: { select: { name: true } },
      order: { select: { price: { select: { name: true } } } },
    },
  });
  for (const entitlement of entitlements) {
    const userId = entitlement.customer.userId;
    if (!userId || !entitlement.updatesUntil) continue;
    items.push({
      storeId: entitlement.storeId,
      userId,
      type: "updates.expiring",
      dedupeKey: `updates.expiring:${entitlement.id}:${entitlement.updatesUntil.getTime()}`,
      data: { product: entitlement.product.name, plan: entitlement.order?.price.name, date: entitlement.updatesUntil.toISOString() },
    });
  }
  return createNotifications(prisma, items);
}

/* ------------------------------------------------------------------ email */

const actionLabel = (type: NotificationType, l: Locale) =>
  type === "support.replied"
    ? copy(l, "Read the reply", "Antwort lesen", "Yanıtı oku")
    : notificationHref(type) === "/account/downloads"
    ? copy(l, "Go to my files", "Zu meinen Dateien", "Dosyalarıma git")
    : notificationHref(type) === "/account/products"
      ? copy(l, "View my products", "Meine Produkte ansehen", "Ürünlerimi gör")
      : copy(l, "Open billing", "Abrechnung öffnen", "Faturalara git");

/**
 * Mails notifications that are still pending. Opted-out categories are marked
 * skipped (a failed payment is always mailed); a failed send is retried on the
 * next run up to MAX_EMAIL_ATTEMPTS times. Does nothing until Plunk is configured.
 */
export async function deliverPendingEmails(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  const result = { sent: 0, skipped: 0, failed: 0 };
  if (!isPlunkConfigured()) return result;
  const now = Date.now();
  await prisma.notification.updateMany({
    where: { emailState: "sending", emailedAt: { lt: new Date(now - EMAIL_CLAIM_TIMEOUT) } },
    data: { emailState: "pending" },
  });
  const rows = await prisma.notification.findMany({
    where: { emailState: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { email: true, emailVerified: true, accountLocale: true, notificationPreference: true } } },
  });
  for (const row of rows) {
    const claim = await prisma.notification.updateMany({ where: { id: row.id, emailState: "pending" }, data: { emailState: "sending", emailedAt: new Date() } });
    if (!claim.count) continue;
    const settle = (emailState: "sent" | "skipped" | "failed" | "pending", attempt = false) =>
      prisma.notification.update({ where: { id: row.id }, data: { emailState, ...(attempt ? { emailAttempts: { increment: 1 } } : {}), ...(emailState === "sent" ? { emailedAt: new Date() } : {}) } });

    if (!isNotificationType(row.type) || now - row.createdAt.getTime() > EMAIL_MAX_AGE || !row.user.emailVerified) {
      await settle("skipped");
      result.skipped++;
      continue;
    }
    const category = notificationCategory(row.type);
    const preference = row.user.notificationPreference;
    const wanted = category === "critical" || (category === "releases" ? (preference?.emailReleases ?? true) : (preference?.emailBilling ?? true));
    if (!wanted) {
      await settle("skipped");
      result.skipped++;
      continue;
    }
    const l: Locale = isLocale(row.user.accountLocale) ? row.user.accountLocale : "en";
    const text = renderNotification(row.type, row.data as NotificationData, l);
    try {
      await sendCustomerNotificationEmail(row.storeId, {
        to: row.user.email,
        subject: text.title,
        heading: text.title,
        body: text.body,
        path: row.href ?? notificationHref(row.type),
        actionText: actionLabel(row.type, l),
        settingsText: copy(l, "Manage notification emails", "E-Mail-Benachrichtigungen verwalten", "Bildirim e-postalarını yönet"),
        lang: l,
      });
      await settle("sent");
      result.sent++;
    } catch (error) {
      console.error("notification email failed", row.id, error instanceof Error ? error.message : error);
      const giveUp = row.emailAttempts + 1 >= MAX_EMAIL_ATTEMPTS;
      await settle(giveUp ? "failed" : "pending", true);
      if (giveUp) result.failed++;
    }
  }
  return result;
}

/** Everything the scheduled job does, in order. */
export async function runNotificationJobs(now = new Date()) {
  const releases = await announcePendingReleases();
  const reminders = await queueReminders(now);
  const emails = await deliverPendingEmails();
  return { releases, reminders, emails };
}

/* ------------------------------------------------------------------ account */

export async function loadNotifications(userId: string, storeId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId, storeId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, type: true, data: true, href: true, readAt: true, createdAt: true },
  });
}

export function unreadNotificationCount(userId: string, storeId: string) {
  return prisma.notification.count({ where: { userId, storeId, readAt: null } });
}

/** Marks the given messages (or, without ids, all of the customer's messages in the store) as read. */
export async function markNotificationsRead(userId: string, storeId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: { userId, storeId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

export async function loadNotificationPreferences(userId: string) {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  return { emailReleases: row?.emailReleases ?? true, emailBilling: row?.emailBilling ?? true };
}

export async function saveNotificationPreferences(userId: string, preferences: { emailReleases: boolean; emailBilling: boolean }) {
  await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...preferences }, update: preferences });
}
