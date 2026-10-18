import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  deleteCategoryRecord,
  deleteTagRecord,
  saveCategoryRecord,
  saveTagRecord,
} from "../lib/taxonomy";
import { runTool, ToolError } from "../lib/result";

const pageSizeSchema = z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20);

export function registerTaxonomyTools(server: McpServer) {
  /* ------------------------------------------------------------- categories */

  server.registerTool(
    "blog_categories_list",
    {
      title: "List blog categories",
      description: "List blog categories with their post counts.",
      inputSchema: {
        q: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: pageSizeSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.CategoryWhereInput = args.q
          ? {
              OR: [
                { name: { contains: args.q, mode: "insensitive" } },
                { slug: { contains: args.q, mode: "insensitive" } },
              ],
            }
          : {};
        const [total, categories] = await Promise.all([
          prisma.category.count({ where }),
          prisma.category.findMany({
            where,
            orderBy: { name: "asc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              color: true,
              createdAt: true,
              _count: { select: { posts: true } },
            },
          }),
        ]);
        return {
          categories: categories.map(({ _count, ...category }) => ({
            ...category,
            postCount: _count.posts,
            createdAt: category.createdAt.toISOString(),
          })),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "blog_categories_create",
    {
      title: "Create a blog category",
      description: "Create a category. The slug is generated from the name when omitted.",
      inputSchema: {
        name: z.string().max(60),
        slug: z.string().optional(),
        description: z.string().max(200).optional(),
        color: z
          .string()
          .optional()
          .describe("Hex color (#RRGGBB or #RRGGBBAA); defaults to #4353e8."),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => saveCategoryRecord(args)),
  );

  server.registerTool(
    "blog_categories_update",
    {
      title: "Update a blog category",
      description: "Update a category's name, slug, description or color.",
      inputSchema: {
        id: z.string(),
        name: z.string().max(60).optional(),
        slug: z.string().optional(),
        description: z.string().max(200).optional(),
        color: z.string().optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.category.findUnique({
          where: { id: args.id },
          select: { name: true, slug: true, description: true, color: true },
        });
        if (!existing) throw new ToolError("Category could not be found.");
        return saveCategoryRecord({
          id: args.id,
          name: args.name ?? existing.name,
          slug: args.slug ?? existing.slug,
          description: args.description ?? existing.description ?? "",
          color: args.color ?? existing.color,
        });
      }),
  );

  server.registerTool(
    "blog_categories_delete",
    {
      title: "Delete a blog category",
      description:
        "Delete a category. Posts are kept and become uncategorized (onDelete: SetNull).",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async (args) => runTool(async () => deleteCategoryRecord(args.id)),
  );

  /* ------------------------------------------------------------------ tags */

  server.registerTool(
    "blog_tags_list",
    {
      title: "List blog tags",
      description: "List blog tags with their post counts.",
      inputSchema: {
        q: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: pageSizeSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.TagWhereInput = args.q
          ? {
              OR: [
                { name: { contains: args.q, mode: "insensitive" } },
                { slug: { contains: args.q, mode: "insensitive" } },
              ],
            }
          : {};
        const [total, tags] = await Promise.all([
          prisma.tag.count({ where }),
          prisma.tag.findMany({
            where,
            orderBy: { name: "asc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              _count: { select: { posts: true } },
            },
          }),
        ]);
        return {
          tags: tags.map(({ _count, ...tag }) => ({
            ...tag,
            postCount: _count.posts,
            createdAt: tag.createdAt.toISOString(),
          })),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "blog_tags_create",
    {
      title: "Create a blog tag",
      description: "Create a tag. The slug is generated from the name when omitted.",
      inputSchema: {
        name: z.string().max(40),
        slug: z.string().optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) => runTool(async () => saveTagRecord(args)),
  );

  server.registerTool(
    "blog_tags_update",
    {
      title: "Update a blog tag",
      description: "Update a tag's name or slug.",
      inputSchema: {
        id: z.string(),
        name: z.string().max(40).optional(),
        slug: z.string().optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.tag.findUnique({
          where: { id: args.id },
          select: { name: true, slug: true },
        });
        if (!existing) throw new ToolError("Tag could not be found.");
        return saveTagRecord({
          id: args.id,
          name: args.name ?? existing.name,
          slug: args.slug ?? existing.slug,
        });
      }),
  );

  server.registerTool(
    "blog_tags_delete",
    {
      title: "Delete a blog tag",
      description: "Delete a tag. Posts stay published; the tag link is removed (cascade).",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async (args) => runTool(async () => deleteTagRecord(args.id)),
  );
}
