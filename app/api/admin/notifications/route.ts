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
};

/**
 * Notifications are derived from live records rather than stored, so they never
 * go stale and no writer has to be wired up yet. Every item links to a panel
 * page that can act on it.
 */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [unverifiedUsers, newUsers, draftThemes, draftExtensions, recentInquiries] = await Promise.all([
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.theme.count({ where: { status: { in: ["concept", "in-development"] } } }),
    prisma.extension.count({ where: { status: { in: ["concept", "planning", "in-development"] } } }),
    prisma.contactInquiry.count({ where: { createdAt: { gte: weekAgo } } }),
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
    });
  }

  if (newUsers > 0) {
    items.push({
      id: "users-new",
      tone: "info",
      title: `${newUsers} account${newUsers === 1 ? "" : "s"} in the last 7 days`,
      detail: "Review the new sign-ups and their roles.",
      href: "/panel/users",
      count: newUsers,
    });
  }

  if (recentInquiries > 0) {
    items.push({
      id: "inquiries-recent",
      tone: "info",
      title: `${recentInquiries} contact request${recentInquiries === 1 ? "" : "s"} this week`,
      detail: "New messages from the contact form are waiting for a reply.",
      href: "/contact",
      count: recentInquiries,
    });
  }

  return Response.json({ notifications: items, total: items.reduce((sum, item) => sum + item.count, 0) });
}
