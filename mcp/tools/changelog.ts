import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CHANGE_KINDS, CHANGELOG_LIMITS, validateChangelog } from "@/lib/catalog-guard";
import { findStoreProduct } from "@/lib/product-admin";
import { readChanges } from "@/lib/changelog";
import { changelogInStore } from "../lib/catalog";
import { runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

const productSelect = { select: { id: true, name: true, slug: true } } as const;

const changesSchema = z
  .array(
    z.object({
      kind: z.enum(CHANGE_KINDS),
      text: z.string().max(CHANGELOG_LIMITS.change),
    }),
  )
  .min(1)
  .max(CHANGELOG_LIMITS.changes);

/** Writes require the same visibility reads have: the product is owned or listed. */
async function assertProductInStore(productId: string) {
  if (!(await findStoreProduct(mcpStoreId(), productId))) {
    throw new ToolError("The chosen product no longer exists in this store.");
  }
}

export function registerChangelogTools(server: McpServer) {
  server.registerTool(
    "changelog_list",
    {
      title: "List changelog entries",
      description:
        "List release notes for this store's products, newest first. Filter by product with productId, or search in version, title and product name.",
      inputSchema: {
        productId: z.string().optional(),
        q: z.string().optional().describe("Search in version, title and product name."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where = {
          AND: [
            changelogInStore(mcpStoreId()),
            ...(args.productId ? [{ productId: args.productId }] : []),
            args.q
              ? {
                  OR: [
                    { version: { contains: args.q, mode: "insensitive" as const } },
                    { title: { contains: args.q, mode: "insensitive" as const } },
                    { product: { name: { contains: args.q, mode: "insensitive" as const } } },
                  ],
                }
              : {},
          ],
        };

        const [total, entries] = await Promise.all([
          prisma.changelogEntry.count({ where }),
          prisma.changelogEntry.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: {
              id: true,
              version: true,
              title: true,
              releasedAt: true,
              changes: true,
              createdAt: true,
              product: productSelect,
            },
          }),
        ]);

        return {
          entries: entries.map(({ changes, ...entry }) => ({
            ...entry,
            changes: readChanges(changes),
            changeCount: Array.isArray(changes) ? changes.length : 0,
            releasedAt: entry.releasedAt.toISOString(),
            createdAt: entry.createdAt.toISOString(),
          })),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "changelog_get",
    {
      title: "Get a changelog entry",
      description: "Return one changelog entry by id.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const entry = await prisma.changelogEntry.findFirst({
          where: { id: args.id, ...changelogInStore(mcpStoreId()) },
          select: {
            id: true,
            version: true,
            title: true,
            releasedAt: true,
            changes: true,
            createdAt: true,
            updatedAt: true,
            product: productSelect,
          },
        });
        if (!entry) throw new ToolError("Changelog entry not found.");
        return {
          ...entry,
          changes: readChanges(entry.changes),
          releasedAt: entry.releasedAt.toISOString(),
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        };
      }),
  );

  server.registerTool(
    "changelog_create",
    {
      title: "Create a changelog entry",
      description:
        "Create a release note for a product. productId accepts every product this store owns or lists.",
      inputSchema: {
        productId: z.string().describe("Product id the entry belongs to (products_list to discover)."),
        version: z.string().max(CHANGELOG_LIMITS.version),
        title: z.string().max(CHANGELOG_LIMITS.title),
        releasedAt: z.string().describe("ISO release date, for example 2026-10-18."),
        changes: changesSchema,
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const validated = validateChangelog(args);
        if ("error" in validated) throw new ToolError(validated.error);
        await assertProductInStore(validated.data.productId);
        const entry = await prisma.changelogEntry.create({
          data: validated.data,
          select: { id: true },
        });
        return entry;
      }),
  );

  server.registerTool(
    "changelog_update",
    {
      title: "Update a changelog entry",
      description:
        "Update any subset of a changelog entry. Omitted fields keep their stored values.",
      inputSchema: {
        id: z.string(),
        productId: z.string().optional().describe("Move the entry to another product."),
        version: z.string().max(CHANGELOG_LIMITS.version).optional(),
        title: z.string().max(CHANGELOG_LIMITS.title).optional(),
        releasedAt: z.string().optional(),
        changes: changesSchema.optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.changelogEntry.findFirst({
          where: { id: args.id, ...changelogInStore(mcpStoreId()) },
          select: {
            id: true,
            productId: true,
            version: true,
            title: true,
            releasedAt: true,
            changes: true,
          },
        });
        if (!existing) throw new ToolError("Changelog entry not found.");

        const body = {
          productId: args.productId ?? existing.productId,
          version: args.version ?? existing.version,
          title: args.title ?? existing.title,
          releasedAt: args.releasedAt ?? existing.releasedAt.toISOString(),
          changes: args.changes ?? readChanges(existing.changes),
        };

        const validated = validateChangelog(body);
        if ("error" in validated) throw new ToolError(validated.error);
        await assertProductInStore(validated.data.productId);

        const entry = await prisma.changelogEntry.update({
          where: { id: args.id },
          data: validated.data,
          select: { id: true },
        });
        return entry;
      }),
  );

  server.registerTool(
    "changelog_delete",
    {
      title: "Delete a changelog entry",
      description: "Permanently delete a changelog entry.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.changelogEntry.findFirst({
          where: { id: args.id, ...changelogInStore(mcpStoreId()) },
          select: { id: true },
        });
        if (!existing) throw new ToolError("Changelog entry not found.");
        await prisma.changelogEntry.delete({ where: { id: args.id } });
        return { id: args.id, deleted: true };
      }),
  );
}
