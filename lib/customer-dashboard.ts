import { prisma } from "./prisma";
import { loadCustomerDownloads } from "./customer-downloads";
import { subscriptionHasAccess } from "./billing-access";

/** Shared accounts see their own purchases across stores; test and live records stay separate. */
export async function loadCustomerDashboard(userId: string, mode: "test" | "prod", now = new Date()) {
  const [products, subscriptions, payments] = await Promise.all([
    loadCustomerDownloads(userId, mode),
    prisma.subscription.findMany({
      where: { mode, customer: { userId, mode }, entitlement: { is: { revokedAt: null } } },
      orderBy: { currentPeriodEnd: "asc" },
      select: {
        id: true, storeId: true, status: true, currentPeriodEnd: true,
        store: { select: { name: true } }, product: { select: { name: true } }, price: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { mode, customer: { userId, mode } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 4,
      select: {
        id: true, storeId: true, type: true, status: true, amountCents: true, currency: true, occurredAt: true,
        store: { select: { name: true } },
        order: { select: { product: { select: { name: true } } } },
        subscription: { select: { product: { select: { name: true } } } },
      },
    }),
  ]);
  const activeSubscriptions = subscriptions.filter((subscription) => subscriptionHasAccess(subscription, now));
  const files = products.flatMap((product) => product.files.map((file) => ({ ...file, productName: product.name, storeName: product.storeName })));
  return {
    productCount: products.length,
    fileCount: files.length,
    activeSubscriptionCount: activeSubscriptions.length,
    awaitingPackageCount: products.filter((product) => product.packageCount === 0).length,
    latestFiles: files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3),
    subscriptions: activeSubscriptions.slice(0, 4),
    payments,
  };
}

export type CustomerDashboard = Awaited<ReturnType<typeof loadCustomerDashboard>>;
