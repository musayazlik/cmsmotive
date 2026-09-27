import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

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
 * verified accounts, published themes) drops out of the counts on its own.
 */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const [unverifiedUsers, unreadInquiries, failedInquiries, draftThemes, draftExtensions] = await Promise.all([
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.contactInquiry.count({ where: { readAt: null, archivedAt: null } }),
    prisma.contactInquiry.count({ where: { readAt: null, archivedAt: null, emailSent: false } }),
    prisma.theme.count({ where: { status: { in: ["concept", "in-development"] } } }),
    prisma.extension.count({ where: { status: { in: ["concept", "planning", "in-development"] } } }),
  ]);

  const items: Notification[] = [];

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

  return Response.json({
    notifications: items,
    total: items.reduce((sum, item) => sum + item.count, 0),
    actionable: items.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0),
  });
}
