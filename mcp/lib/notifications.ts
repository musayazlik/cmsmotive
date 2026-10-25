import { prisma } from "@/lib/prisma";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { panelHref } from "@/lib/admin-access-shared";
import { mcpStoreId } from "@/mcp/context";

/**
 * Derived panel notifications, mirrored from GET /api/admin/notifications.
 * Nothing is stored: every item recalculates from live records so handled
 * work drops out on its own.
 */
export type McpNotification = {
  id: string;
  tone: "info" | "warn";
  title: string;
  detail: string;
  href: string;
  count: number;
  actionable: boolean;
};

export async function listNotifications() {
  const [{ panelPath }, unverifiedUsers, unreadInquiries, failedInquiries, unpublishedProducts, pendingReviews] =
    await Promise.all([
      getAdminAccessSettings(),
      prisma.user.count({ where: { emailVerified: false } }),
      prisma.contactInquiry.count({ where: { storeId: mcpStoreId(), readAt: null, archivedAt: null } }),
      prisma.contactInquiry.count({
        where: { storeId: mcpStoreId(), readAt: null, archivedAt: null, emailSent: false },
      }),
      // Products on the roadmap: only published ones appear in the catalogue.
      prisma.product.count({ where: { storeId: mcpStoreId(), status: { not: "published" } } }),
      prisma.productReview.count({ where: { storeId: mcpStoreId(), status: "pending" } }),
    ]);

  const items: McpNotification[] = [];

  if (unverifiedUsers > 0) {
    items.push({
      id: "users-unverified",
      tone: "warn",
      title: `${unverifiedUsers} unverified account${unverifiedUsers === 1 ? "" : "s"}`,
      detail: "These accounts cannot sign in until the e-mail address is confirmed.",
      href: "/panel/users",
      count: unverifiedUsers,
      actionable: true,
    });
  }

  if (unreadInquiries > 0) {
    items.push({
      id: "inquiries-unread",
      tone: failedInquiries > 0 ? "warn" : "info",
      title: `${unreadInquiries} unread contact message${unreadInquiries === 1 ? "" : "s"}`,
      detail:
        failedInquiries > 0
          ? `${failedInquiries} of them got no e-mail confirmation — worth a direct reply.`
          : "New messages from the contact form are waiting to be read.",
      href: "/panel/inbox",
      count: unreadInquiries,
      actionable: true,
    });
  }

  if (unpublishedProducts > 0) {
    items.push({
      id: "products-unpublished",
      tone: "info",
      title: `${unpublishedProducts} product${unpublishedProducts === 1 ? "" : "s"} not published`,
      detail: "Products in concept, planning or development are hidden from the catalogue.",
      href: "/panel/products",
      count: unpublishedProducts,
      actionable: false,
    });
  }

  if (pendingReviews > 0) {
    items.push({
      id: "reviews-pending",
      tone: "warn",
      title: `${pendingReviews} review${pendingReviews === 1 ? "" : "s"} awaiting moderation`,
      detail: "New guest reviews stay hidden from the product pages until they are approved.",
      href: "/panel/reviews",
      count: pendingReviews,
      actionable: true,
    });
  }

  return {
    notifications: items.map((item) => ({ ...item, href: panelHref(item.href, panelPath) })),
    total: items.reduce((sum, item) => sum + item.count, 0),
    actionable: items.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0),
  };
}
