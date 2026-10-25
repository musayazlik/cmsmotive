import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getDailyReads,
  getMailStatus,
  getStorageStatus,
  getSystemStatus,
} from "@/lib/status";
import { getMcpActorUserId } from "@/lib/mcp-settings";
import { resolveMcpActor } from "../context";
import { storeAdminWhere } from "@/lib/store-access";
import { listNotifications } from "../lib/notifications";
import { changelogInStore } from "../lib/catalog";
import { runTool } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

export function registerStatsTools(server: McpServer) {
  server.registerTool(
    "stats_overview",
    {
      title: "Panel overview statistics",
      description:
        "Return the counts shown across the panel: posts by status, products by status and type, changelog entries, users, moderation queues, newsletter subscribers, storage usage and host resources.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runTool(async () => {
        const [
          postsByStatus,
          productsByStatus,
          productsByType,
          productTypes,
          changelogEntries,
          users,
          admins,
          subscribers,
          pendingReviews,
          unreadInquiries,
          archivedInquiries,
          storage,
          system,
        ] = await Promise.all([
          prisma.post.groupBy({ by: ["status"], where: { storeId: mcpStoreId() }, _count: { _all: true } }),
          prisma.product.groupBy({ by: ["status"], where: { storeId: mcpStoreId() }, _count: { _all: true } }),
          prisma.product.groupBy({ by: ["typeId"], where: { storeId: mcpStoreId() }, _count: { _all: true } }),
          prisma.productType.findMany({ select: { id: true, key: true } }),
          prisma.changelogEntry.count({ where: changelogInStore(mcpStoreId()) }),
          prisma.storeMember.count({ where: { storeId: mcpStoreId(), user: { role: { not: "superadmin" } } } }),
          prisma.user.count({ where: storeAdminWhere(mcpStoreId()) }),
          prisma.newsletterSubscriber.count({ where: { storeId: mcpStoreId() } }),
          prisma.productReview.count({ where: { storeId: mcpStoreId(), status: "pending" } }),
          prisma.contactInquiry.count({ where: { storeId: mcpStoreId(), readAt: null, archivedAt: null } }),
          prisma.contactInquiry.count({ where: { storeId: mcpStoreId(), archivedAt: { not: null } } }),
          getStorageStatus(),
          getSystemStatus(),
        ]);

        const postCounts = Object.fromEntries(
          postsByStatus.map((row) => [row.status, row._count._all]),
        ) as Record<string, number>;
        const typeKeys = new Map(productTypes.map((type) => [type.id, type.key]));

        return {
          content: {
            posts: {
              total: postsByStatus.reduce((sum, row) => sum + row._count._all, 0),
              draft: postCounts.draft ?? 0,
              scheduled: postCounts.scheduled ?? 0,
              published: postCounts.published ?? 0,
            },
            products: {
              total: productsByStatus.reduce((sum, row) => sum + row._count._all, 0),
              byStatus: Object.fromEntries(productsByStatus.map((row) => [row.status, row._count._all])),
              byType: Object.fromEntries(productsByType.map((row) => [typeKeys.get(row.typeId) ?? row.typeId, row._count._all])),
            },
            changelogEntries,
          },
          accounts: { users, admins, subscribers },
          moderation: { pendingReviews, unreadInquiries, archivedInquiries },
          storage,
          system,
        };
      }),
  );

  server.registerTool(
    "stats_daily_reads",
    {
      title: "Daily page reads",
      description:
        "Return the daily page-view series used by the panel overview, newest day first, including the top slug per day.",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(14),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => runTool(async () => getDailyReads(mcpStoreId(), args.days)),
  );

  server.registerTool(
    "stats_system",
    {
      title: "Host system status",
      description: "Return CPU, memory and disk usage for the machine running the CMS.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runTool(async () => getSystemStatus()),
  );

  server.registerTool(
    "stats_mail",
    {
      title: "Mail and inquiry status",
      description:
        "Return Plunk configuration status, contact message delivery counts and newsletter subscriber count.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runTool(async () => getMailStatus(mcpStoreId())),
  );

  server.registerTool(
    "notifications_list",
    {
      title: "List panel notifications",
      description:
        "Return the live-derived panel notifications (unverified accounts, unread messages, unpublished products). Nothing is stored.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runTool(async () => listNotifications()),
  );

  server.registerTool(
    "account_info",
    {
      title: "Current MCP identity",
      description: "Return the admin panel account that MCP writes are attributed to.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runTool(async () => {
        const [actor, configured] = await Promise.all([resolveMcpActor(), getMcpActorUserId(mcpStoreId())]);
        return {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
          source: configured ? "settings" : "first-admin",
        };
      }),
  );
}
