import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { iso, runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

const inquirySelect = {
  id: true,
  name: true,
  email: true,
  agency: true,
  typo3Version: true,
  license: true,
  message: true,
  emailSent: true,
  readAt: true,
  archivedAt: true,
  createdAt: true,
} as const;

export function registerInboxTools(server: McpServer) {
  server.registerTool(
    "inbox_list",
    {
      title: "List contact messages",
      description:
        "List contact form messages with read and archive filters. Messages are never deleted from the inbox.",
      inputSchema: {
        archived: z.boolean().default(false).describe("false = inbox, true = archive."),
        read: z.boolean().optional(),
        q: z.string().optional().describe("Search in name, e-mail, agency and message."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.ContactInquiryWhereInput = {
          storeId: mcpStoreId(),
          archivedAt: args.archived ? { not: null } : null,
          ...(args.read === true ? { readAt: { not: null } } : {}),
          ...(args.read === false ? { readAt: null } : {}),
          ...(args.q
            ? {
                OR: [
                  { name: { contains: args.q, mode: "insensitive" } },
                  { email: { contains: args.q, mode: "insensitive" } },
                  { agency: { contains: args.q, mode: "insensitive" } },
                  { message: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [total, inquiries] = await Promise.all([
          prisma.contactInquiry.count({ where }),
          prisma.contactInquiry.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: inquirySelect,
          }),
        ]);

        return {
          inquiries: inquiries.map((inquiry) => ({
            ...inquiry,
            readAt: iso(inquiry.readAt),
            archivedAt: iso(inquiry.archivedAt),
            createdAt: inquiry.createdAt.toISOString(),
          })),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "inbox_set_read",
    {
      title: "Mark a contact message read or unread",
      description: "Set or clear the read timestamp on an inbox message.",
      inputSchema: {
        id: z.string(),
        read: z.boolean(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.contactInquiry.findFirst({
          where: { id: args.id, storeId: mcpStoreId() },
          select: { id: true },
        });
        if (!existing) throw new ToolError("This message no longer exists.");
        await prisma.contactInquiry.update({
          where: { id: args.id },
          data: { readAt: args.read ? new Date() : null },
        });
        return { id: args.id, read: args.read };
      }),
  );

  server.registerTool(
    "inbox_set_archived",
    {
      title: "Archive or restore a contact message",
      description:
        "Archive a message (which also marks it read) or restore it to the inbox. The message is never deleted.",
      inputSchema: {
        id: z.string(),
        archived: z.boolean(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        const current = await prisma.contactInquiry.findFirst({
          where: { id: args.id, storeId: mcpStoreId() },
          select: { readAt: true },
        });
        if (!current) throw new ToolError("This message no longer exists.");
        await prisma.contactInquiry.update({
          where: { id: args.id },
          data: args.archived
            ? { archivedAt: new Date(), readAt: current.readAt ?? new Date() }
            : { archivedAt: null },
        });
        return { id: args.id, archived: args.archived };
      }),
  );
}
