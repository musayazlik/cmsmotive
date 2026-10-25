import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  EXTENSION_STATUSES,
  MAX_GALLERY,
  readCompatibility,
} from "@/lib/catalog-guard";
import {
  createExtension,
  deleteExtensionRecord,
  updateExtension,
} from "../lib/catalog";
import { iso, runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

const compatibilitySchema = z.object({
  area: z.string(),
  target: z.string().default(""),
  status: z.string().default(""),
});

const extensionListSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  status: true,
  position: true,
  cover: { select: { id: true, url: true, fileName: true } },
  gallery: {
    orderBy: { position: "asc" },
    select: { asset: { select: { id: true, url: true, fileName: true } } },
  },
  createdAt: true,
  updatedAt: true,
} as const;

const extensionDetailSelect = {
  ...extensionListSelect,
  tagline: true,
  intro: true,
  highlights: true,
  compatibility: true,
  ctaLabel: true,
  ctaUrl: true,
  demoUrl: true,
  cover: { select: { id: true, url: true, fileName: true, alt: true } },
  gallery: {
    orderBy: { position: "asc" },
    select: {
      position: true,
      asset: { select: { id: true, url: true, fileName: true, alt: true } },
    },
  },
  _count: { select: { changelog: true, reviews: true } },
} as const;

function flattenListRow(
  extension: Prisma.ExtensionGetPayload<{ select: typeof extensionListSelect }>,
) {
  return {
    ...extension,
    cover: extension.cover
      ? {
          assetId: extension.cover.id,
          url: extension.cover.url,
          fileName: extension.cover.fileName,
        }
      : null,
    gallery: extension.gallery.map((entry) => ({
      assetId: entry.asset.id,
      url: entry.asset.url,
      fileName: entry.asset.fileName,
    })),
    createdAt: iso(extension.createdAt),
    updatedAt: iso(extension.updatedAt),
  };
}

const detailFields = {
  tagline: z.string().max(80).optional(),
  intro: z.string().max(400).optional(),
  highlights: z.array(z.string().max(120)).max(8).optional(),
  compatibility: z.array(compatibilitySchema).max(20).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(300).optional(),
  demoUrl: z.string().max(300).optional(),
};

export function registerExtensionTools(server: McpServer) {
  server.registerTool(
    "extensions_list",
    {
      title: "List extensions",
      description:
        "List extensions with catalogue filters. Ordered like the public catalogue (position, then creation date).",
      inputSchema: {
        q: z.string().optional().describe("Search in name, slug and summary."),
        status: z.array(z.enum(EXTENSION_STATUSES)).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
        orderBy: z.enum(["position", "createdAt", "updatedAt", "name"]).default("position"),
        order: z.enum(["asc", "desc"]).default("asc"),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.ExtensionWhereInput = {
          storeId: mcpStoreId(),
          ...(args.q
            ? {
                OR: [
                  { name: { contains: args.q, mode: "insensitive" } },
                  { slug: { contains: args.q, mode: "insensitive" } },
                  { summary: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(args.status && args.status.length > 0 ? { status: { in: args.status } } : {}),
        };

        const orderBy: Prisma.ExtensionOrderByWithRelationInput[] =
          args.orderBy === "position"
            ? [{ position: args.order }, { createdAt: "asc" }]
            : [{ [args.orderBy]: args.order }];

        const [total, extensions] = await Promise.all([
          prisma.extension.count({ where }),
          prisma.extension.findMany({
            where,
            orderBy,
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: extensionListSelect,
          }),
        ]);

        return {
          extensions: extensions.map(flattenListRow),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "extensions_get",
    {
      title: "Get an extension",
      description:
        "Return one extension by id or slug, including its detail fields, gallery, changelog/review counts and pending review count.",
      inputSchema: {
        id: z.string().optional(),
        slug: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        if (!args.id && !args.slug) throw new ToolError("Provide either id or slug.");
        const extension = await prisma.extension.findFirst({
          where: { storeId: mcpStoreId(), ...(args.id ? { id: args.id } : { slug: args.slug }) },
          select: extensionDetailSelect,
        });
        if (!extension) throw new ToolError("Extension not found.");

        const pendingReviews = await prisma.productReview.count({
          where: { storeId: mcpStoreId(), extensionId: extension.id, status: "pending" },
        });

        return {
          ...extension,
          compatibility: readCompatibility(extension.compatibility),
          cover: extension.cover
            ? {
                assetId: extension.cover.id,
                url: extension.cover.url,
                fileName: extension.cover.fileName,
                alt: extension.cover.alt,
              }
            : null,
          gallery: extension.gallery.map((entry) => ({
            assetId: entry.asset.id,
            url: entry.asset.url,
            fileName: entry.asset.fileName,
            alt: entry.asset.alt,
            position: entry.position,
          })),
          counts: {
            changelog: extension._count.changelog,
            reviews: extension._count.reviews,
            pendingReviews,
          },
          _count: undefined,
          createdAt: iso(extension.createdAt),
          updatedAt: iso(extension.updatedAt),
        };
      }),
  );

  server.registerTool(
    "extensions_create",
    {
      title: "Create an extension",
      description:
        "Create an extension. name, summary and description are required. The slug is generated from the name when omitted.",
      inputSchema: {
        name: z.string().min(2).max(80),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300),
        description: z.string().min(10).describe("Tiptap HTML output."),
        status: z.enum(EXTENSION_STATUSES).default("concept"),
        position: z.number().int().min(0).max(9999).optional(),
        ...detailFields,
        coverId: z.string().nullable().optional(),
        galleryIds: z.array(z.string()).max(MAX_GALLERY).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () =>
        createExtension({
          ...args,
          status: args.status ?? "concept",
        }),
      ),
  );

  server.registerTool(
    "extensions_update",
    {
      title: "Update an extension",
      description:
        "Update any subset of an extension's fields. Omitted fields keep their stored values. Pass null for coverId to clear it; pass galleryIds to replace the gallery order and contents.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(2).max(80).optional(),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300).optional(),
        description: z.string().min(10).optional(),
        status: z.enum(EXTENSION_STATUSES).optional(),
        position: z.number().int().min(0).max(9999).optional(),
        ...detailFields,
        coverId: z.string().nullable().optional(),
        galleryIds: z.array(z.string()).max(MAX_GALLERY).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const { id, ...input } = args;
        return updateExtension(id, input);
      }),
  );

  server.registerTool(
    "extensions_delete",
    {
      title: "Delete an extension",
      description:
        "Permanently delete an extension. Its gallery, changelog entries and reviews are removed by cascade; uploaded media stays in the library.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => runTool(async () => deleteExtensionRecord(args.id)),
  );
}
