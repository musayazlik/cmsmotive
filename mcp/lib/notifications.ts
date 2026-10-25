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
  const [{ panelPath }, unverifiedUsers, unreadInquiries, failedInquiries, draftThemes, draftExtensions] =
    await Promise.all([
      getAdminAccessSettings(),
      prisma.user.count({ where: { emailVerified: false } }),
      prisma.contactInquiry.count({ where: { storeId: mcpStoreId(), readAt: null, archivedAt: null } }),
      prisma.contactInquiry.count({
        where: { storeId: mcpStoreId(), readAt: null, archivedAt: null, emailSent: false },
      }),
      prisma.theme.count({ where: { storeId: mcpStoreId(), status: { in: ["concept", "in-development"] } } }),
      prisma.extension.count({
        where: { storeId: mcpStoreId(), status: { in: ["concept", "planning", "in-development"] } },
      }),
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

  if (draftThemes > 0) {
    items.push({
      id: "themes-draft",
      tone: "info",
      title: `${draftThemes} theme${draftThemes === 1 ? "" : "s"} not published`,
      detail: "Themes still in concept or development are hidden from the catalogue.",
      href: "/panel/themes",
      count: draftThemes,
      actionable: false,
    });
  }

  if (draftExtensions > 0) {
    items.push({
      id: "extensions-draft",
      tone: "info",
      title: `${draftExtensions} extension${draftExtensions === 1 ? "" : "s"} on the roadmap`,
      detail: "Extensions in planning are shown as concept cards only.",
      href: "/panel/extensions",
      count: draftExtensions,
      actionable: false,
    });
  }

  return {
    notifications: items.map((item) => ({ ...item, href: panelHref(item.href, panelPath) })),
    total: items.reduce((sum, item) => sum + item.count, 0),
    actionable: items.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0),
  };
}
