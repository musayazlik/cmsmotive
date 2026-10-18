import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  MAX_GALLERY,
  MAX_PRICE,
  readCompatibility,
  readLicences,
  THEME_INDUSTRIES,
  THEME_STATUSES,
  VERSION_TARGETS,
} from "@/lib/catalog-guard";
import { createTheme, deleteThemeRecord, updateTheme } from "../lib/catalog";
import { iso, runTool, ToolError } from "../lib/result";

const compatibilitySchema = z.object({
  area: z.string(),
  target: z.string().default(""),
  status: z.string().default(""),
});

const licenceSchema = z.object({
  name: z.string(),
  price: z.number().int().min(0).max(MAX_PRICE),
});

const themeListSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  status: true,
  industry: true,
  versionTarget: true,
  price: true,
  position: true,
  cover: { select: { id: true, url: true, fileName: true } },
  gallery: {
    orderBy: { position: "asc" },
    select: { asset: { select: { id: true, url: true, fileName: true } } },
  },
  createdAt: true,
  updatedAt: true,
} as const;

const themeDetailSelect = {
  ...themeListSelect,
  tagline: true,
  intro: true,
  highlights: true,
  compatibility: true,
  licences: true,
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

function flattenListRow(theme: Prisma.ThemeGetPayload<{ select: typeof themeListSelect }>) {
  return {
    ...theme,
    cover: theme.cover
      ? { assetId: theme.cover.id, url: theme.cover.url, fileName: theme.cover.fileName }
      : null,
    gallery: theme.gallery.map((entry) => ({
      assetId: entry.asset.id,
      url: entry.asset.url,
      fileName: entry.asset.fileName,
    })),
    createdAt: iso(theme.createdAt),
    updatedAt: iso(theme.updatedAt),
  };
}

const detailFields = {
  tagline: z.string().max(80).optional(),
  intro: z.string().max(400).optional(),
  highlights: z.array(z.string().max(120)).max(8).optional(),
  compatibility: z.array(compatibilitySchema).max(20).optional(),
  licences: z.array(licenceSchema).max(6).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(300).optional(),
  demoUrl: z.string().max(300).optional(),
};

export function registerThemeTools(server: McpServer) {
  server.registerTool(
    "themes_list",
    {
      title: "List themes",
      description:
        "List themes with catalogue filters. Ordered like the public catalogue (position, then creation date).",
      inputSchema: {
        q: z.string().optional().describe("Search in name, slug, summary and industry."),
        status: z.array(z.enum(THEME_STATUSES)).optional(),
        industry: z.enum(THEME_INDUSTRIES).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
        orderBy: z.enum(["position", "createdAt", "updatedAt", "name"]).default("position"),
        order: z.enum(["asc", "desc"]).default("asc"),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.ThemeWhereInput = {
          ...(args.q
            ? {
                OR: [
                  { name: { contains: args.q, mode: "insensitive" } },
                  { slug: { contains: args.q, mode: "insensitive" } },
                  { summary: { contains: args.q, mode: "insensitive" } },
                  { industry: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(args.status && args.status.length > 0 ? { status: { in: args.status } } : {}),
          ...(args.industry ? { industry: args.industry } : {}),
        };

        const orderBy: Prisma.ThemeOrderByWithRelationInput[] =
          args.orderBy === "position"
            ? [{ position: args.order }, { createdAt: "asc" }]
            : [{ [args.orderBy]: args.order }];

        const [total, themes] = await Promise.all([
          prisma.theme.count({ where }),
          prisma.theme.findMany({
            where,
            orderBy,
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: themeListSelect,
          }),
        ]);

        return {
          themes: themes.map(flattenListRow),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "themes_get",
    {
      title: "Get a theme",
      description:
        "Return one theme by id or slug, including its detail fields, gallery, changelog/review counts and pending review count.",
      inputSchema: {
        id: z.string().optional(),
        slug: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        if (!args.id && !args.slug) throw new ToolError("Provide either id or slug.");
        const theme = await prisma.theme.findUnique({
          where: args.id ? { id: args.id } : { slug: args.slug },
          select: themeDetailSelect,
        });
        if (!theme) throw new ToolError("Theme not found.");

        const pendingReviews = await prisma.productReview.count({
          where: { themeId: theme.id, status: "pending" },
        });

        return {
          ...theme,
          compatibility: readCompatibility(theme.compatibility),
          licences: readLicences(theme.licences),
          cover: theme.cover
            ? { assetId: theme.cover.id, url: theme.cover.url, fileName: theme.cover.fileName, alt: theme.cover.alt }
            : null,
          gallery: theme.gallery.map((entry) => ({
            assetId: entry.asset.id,
            url: entry.asset.url,
            fileName: entry.asset.fileName,
            alt: entry.asset.alt,
            position: entry.position,
          })),
          counts: {
            changelog: theme._count.changelog,
            reviews: theme._count.reviews,
            pendingReviews,
          },
          _count: undefined,
          createdAt: iso(theme.createdAt),
          updatedAt: iso(theme.updatedAt),
        };
      }),
  );

  server.registerTool(
    "themes_create",
    {
      title: "Create a theme",
      description:
        "Create a theme. name, summary, description, industry and versionTarget are required. The slug is generated from the name when omitted.",
      inputSchema: {
        name: z.string().min(2).max(80),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300),
        description: z.string().min(10).describe("Tiptap HTML output."),
        status: z.enum(THEME_STATUSES).default("concept"),
        industry: z.enum(THEME_INDUSTRIES),
        versionTarget: z.enum(VERSION_TARGETS),
        price: z.number().int().min(0).max(MAX_PRICE).nullable().optional(),
        position: z.number().int().min(0).max(9999).optional(),
        ...detailFields,
        coverId: z.string().nullable().optional(),
        galleryIds: z.array(z.string()).max(MAX_GALLERY).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () =>
        createTheme({
          ...args,
          status: args.status ?? "concept",
        }),
      ),
  );

  server.registerTool(
    "themes_update",
    {
      title: "Update a theme",
      description:
        "Update any subset of a theme's fields. Omitted fields keep their stored values. Pass null for price or coverId to clear them; pass galleryIds to replace the gallery order and contents.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(2).max(80).optional(),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300).optional(),
        description: z.string().min(10).optional(),
        status: z.enum(THEME_STATUSES).optional(),
        industry: z.enum(THEME_INDUSTRIES).optional(),
        versionTarget: z.enum(VERSION_TARGETS).optional(),
        price: z.number().int().min(0).max(MAX_PRICE).nullable().optional(),
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
        return updateTheme(id, input);
      }),
  );

  server.registerTool(
    "themes_delete",
    {
      title: "Delete a theme",
      description:
        "Permanently delete a theme. Its gallery, changelog entries and reviews are removed by cascade; uploaded media stays in the library.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => runTool(async () => deleteThemeRecord(args.id)),
  );
}
