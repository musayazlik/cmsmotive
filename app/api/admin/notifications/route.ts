import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { panelHref } from "@/lib/admin-access-shared";
import { panelStore } from "@/lib/panel-store";

export const runtime = "nodejs";

type Notification = {
  id: string;
  tone: "info" | "warn";
  title: string;
  detail: string;
  href: string;
  count: number;
  /** Counts toward the bell badge; informational items stay menu-only. */
  actionable: boolean;
};

/**
 * Notifications are derived from live records rather than stored, so they
 * never go stale and no writer has to be wired up. Every item links to a
 * panel page that can act on it. Handled work (read/archived messages,
 * verified accounts, published products) drops out of the counts on its own.
 */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

  const [{ panelPath }, unverifiedUsers, unreadInquiries, failedInquiries, roadmapProducts, pendingComments] = await Promise.all([
    getAdminAccessSettings(),
    prisma.user.count({ where: { emailVerified: false, storeMemberships: { some: { storeId } } } }),
    prisma.contactInquiry.count({ where: { storeId, readAt: null, archivedAt: null } }),
    prisma.contactInquiry.count({ where: { storeId, readAt: null, archivedAt: null, emailSent: false } }),
    prisma.product.count({ where: { storeId, status: { in: ["concept", "planning", "in-development"] } } }),
    prisma.postComment.count({ where: { post: { storeId }, status: "pending" } }),
  ]);

  const items: Notification[] = [];

  if (pendingComments > 0) {
    items.push({ id: "blog-comments-pending", tone: "info", title: `${pendingComments} blog comment${pendingComments === 1 ? "" : "s"} awaiting approval`, detail: "Review these comments before they appear on the blog.", href: "/panel/blog/comments", count: pendingComments, actionable: true });
  }

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
      // Unread messages whose notification mail failed deserve more urgency.
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

  if (roadmapProducts > 0) {
    items.push({
      id: "products-roadmap",
      tone: "info",
      title: `${roadmapProducts} product${roadmapProducts === 1 ? "" : "s"} not published yet`,
      detail: "Concepts and work in progress are shown as roadmap cards only.",
      href: "/panel/products",
      count: roadmapProducts,
      actionable: false,
    });
  }

  return Response.json({
    notifications: items.map((item) => ({ ...item, href: panelHref(item.href, panelPath) })),
    total: items.reduce((sum, item) => sum + item.count, 0),
    actionable: items.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
