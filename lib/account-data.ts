import { isAdminRole } from "./admin-guard";
import { avatarFileKey } from "./avatar-file";
import { prisma } from "./prisma";

/**
 * The customer's rights over their own data (GDPR art. 15, 17 and 20, KVKK
 * art. 11): a machine-readable copy of everything stored about the account,
 * and deleting the account.
 *
 * Deletion removes the account and everything only it needs (sessions,
 * sign-in methods, notifications, support requests, newsletter sign-ups, the
 * uploaded photo). Purchase records cannot simply disappear: orders, payments
 * and licences stay for bookkeeping and licence validity, but lose every
 * personal detail (the customer rows keep no name, email or account link).
 * Creem, as merchant of record, keeps its own invoices under its own policy.
 */

/** Subscription states that still bill or may bill again; they must be cancelled first. */
const BILLING_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused"];

export type DeletionBlocker = "admin" | "active-subscription";

export async function deletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const [user, adminMembership, billing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.storeMember.findFirst({ where: { userId, role: { in: ["admin", "superadmin"] } }, select: { storeId: true } }),
    prisma.subscription.findFirst({ where: { status: { in: BILLING_STATUSES }, customer: { userId } }, select: { id: true } }),
  ]);
  const blockers: DeletionBlocker[] = [];
  // Staff accounts are removed by another administrator in the panel, never by themselves here.
  if (isAdminRole(user?.role) || adminMembership) blockers.push("admin");
  if (billing) blockers.push("active-subscription");
  return blockers;
}

export const ANONYMIZED_EMAIL = "deleted-account@anonymized.invalid";

/** Deletes the account after re-checking the blockers. Returns false when one applies. */
export async function deleteAccount(userId: string): Promise<boolean> {
  if ((await deletionBlockers(userId)).length) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, image: true } });
  if (!user) return false;
  await prisma.$transaction(async (tx) => {
    await tx.customer.updateMany({ where: { userId }, data: { userId: null, email: ANONYMIZED_EMAIL, name: null } });
    await tx.newsletterSubscriber.deleteMany({ where: { email: user.email } });
    await tx.productReview.updateMany({ where: { authorEmail: user.email }, data: { authorEmail: ANONYMIZED_EMAIL, authorName: "Former customer" } });
    await tx.postComment.updateMany({ where: { authorEmail: user.email }, data: { authorEmail: ANONYMIZED_EMAIL, authorName: "Former reader" } });
    // Sessions, sign-in methods, notifications, preferences, store memberships and support requests cascade.
    await tx.user.delete({ where: { id: userId } });
  });
  const avatar = user.image ? avatarFileKey(user.image) : null;
  if (avatar) {
    const { utapi } = await import("./utapi");
    await utapi.deleteFiles(avatar).catch((error) => console.error("account deletion: avatar cleanup failed", error instanceof Error ? error.message : error));
  }
  return true;
}

/** Everything stored about the account, as one JSON document. Secrets (password hashes, tokens) are left out. */
export async function exportAccountData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, emailVerified: true, image: true, bio: true, phone: true, company: true,
      street: true, postalCode: true, city: true, country: true, accountLocale: true, termsVersion: true,
      privacyVersion: true, termsAcceptedAt: true, createdAt: true, updatedAt: true,
    },
  });
  const [accounts, sessions, memberships, customers, checkouts, notifications, preference, newsletter, reviews, comments, tickets] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { providerId: true, createdAt: true } }),
    prisma.session.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
    prisma.storeMember.findMany({ where: { userId }, select: { role: true, store: { select: { name: true } } } }),
    prisma.customer.findMany({
      where: { userId },
      select: {
        email: true, name: true, country: true, mode: true, createdAt: true, store: { select: { name: true } },
        orders: { select: { creemOrderId: true, type: true, status: true, amountCents: true, currency: true, placedAt: true, product: { select: { name: true } }, price: { select: { name: true } } } },
        subscriptions: { select: { status: true, currentPeriodStart: true, currentPeriodEnd: true, canceledAt: true, product: { select: { name: true } }, price: { select: { name: true } } } },
        entitlements: {
          select: {
            createdAt: true, updatesUntil: true, seats: true, revokedAt: true, revokeReason: true, product: { select: { name: true } },
            licenseKeys: { select: { key: true, status: true, activations: true, activationLimit: true, expiresAt: true } },
          },
        },
        transactions: { select: { type: true, status: true, amountCents: true, amountPaidCents: true, taxCents: true, refundedCents: true, currency: true, description: true, occurredAt: true } },
      },
    }),
    prisma.checkoutAttempt.findMany({ where: { userId }, select: { createdAt: true, mode: true, termsVersion: true, privacyVersion: true, price: { select: { name: true } } } }),
    prisma.notification.findMany({ where: { userId }, select: { type: true, data: true, readAt: true, createdAt: true } }),
    prisma.notificationPreference.findUnique({ where: { userId }, select: { emailReleases: true, emailBilling: true, updatedAt: true } }),
    prisma.newsletterSubscriber.findMany({ where: { email: user.email }, select: { firstName: true, lastName: true, source: true, locale: true, consentVersion: true, confirmedAt: true, unsubscribedAt: true, createdAt: true, store: { select: { name: true } } } }),
    prisma.productReview.findMany({ where: { authorEmail: user.email }, select: { authorName: true, rating: true, body: true, status: true, createdAt: true, product: { select: { name: true } } } }),
    prisma.postComment.findMany({ where: { authorEmail: user.email }, select: { authorName: true, body: true, status: true, createdAt: true, post: { select: { title: true } } } }),
    prisma.supportTicket.findMany({
      where: { userId },
      select: { subject: true, status: true, createdAt: true, product: { select: { name: true } }, messages: { select: { body: true, fromStaff: true, createdAt: true } } },
    }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    note: "Personal data stored by CMSMotive for this account. Payments are processed by Creem (merchant of record), which keeps its own records.",
    account: user,
    signInMethods: accounts,
    sessions,
    storeMemberships: memberships.map((membership) => ({ store: membership.store.name, role: membership.role })),
    purchases: customers,
    checkoutConsents: checkouts,
    notificationPreferences: preference,
    notifications,
    newsletter,
    productReviews: reviews,
    blogComments: comments,
    supportRequests: tickets,
  };
}
