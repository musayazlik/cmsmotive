import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CHANGE_KINDS,
  CHANGELOG_LIMITS,
  validateChangelog,
} from "@/lib/catalog-guard";
import { productExists, readChanges } from "@/lib/changelog";
import { runTool, ToolError } from "../lib/result";

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

/** "theme:<id>", "extension:<id>", "type:theme" or "type:extension" → a Prisma filter. */
function productFilter(value: string | undefined): Prisma.ChangelogEntryWhereInput {
  if (!value) return {};
  if (value === "type:theme") return { themeId: { not: null } };
  if (value === "type:extension") return { extensionId: { not: null } };
  const match = value.match(/^(theme|extension):(\S+)$/);
  if (!match) return {};
  return match[1] === "theme" ? { themeId: match[2] } : { extensionId: match[2] };
}

function productRef(themeId: string | null, extensionId: string | null): string {
  if (themeId) return `theme:${themeId}`;
  if (extensionId) return `extension:${extensionId}`;
  return "";
}

export function registerChangelogTools(server: McpServer) {
  server.registerTool(
    "changelog_list",
    {
      title: "List changelog entries",
      description:
        "List release notes for themes and extensions, newest first. Filter by product with theme:<id> or extension:<id>, or by type with type:theme / type:extension.",
      inputSchema: {
        product: z.string().optional().describe("theme:<id>, extension:<id>, type:theme or type:extension."),
        q: z.string().optional().describe("Search in version, title and product name."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.ChangelogEntryWhereInput = {
          ...productFilter(args.product),
          ...(args.q
            ? {
                OR: [
                  { version: { contains: args.q, mode: "insensitive" } },
                  { title: { contains: args.q, mode: "insensitive" } },
                  { theme: { name: { contains: args.q, mode: "insensitive" } } },
                  { extension: { name: { contains: args.q, mode: "insensitive" } } },
                ],
              }
            : {}),
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
              theme: productSelect,
              extension: productSelect,
            },
          }),
        ]);

        return {
          entries: entries.map(({ theme, extension, changes, ...entry }) => ({
            ...entry,
            product: theme
              ? { type: "theme", ...theme }
              : extension
                ? { type: "extension", ...extension }
                : null,
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
        const entry = await prisma.changelogEntry.findUnique({
          where: { id: args.id },
          select: {
            id: true,
            version: true,
            title: true,
            releasedAt: true,
            changes: true,
            createdAt: true,
            updatedAt: true,
            theme: productSelect,
            extension: productSelect,
          },
        });
        if (!entry) throw new ToolError("Changelog entry not found.");
        return {
          ...entry,
          changes: readChanges(entry.changes),
          product: entry.theme
            ? { type: "theme", ...entry.theme }
            : entry.extension
              ? { type: "extension", ...entry.extension }
              : null,
          theme: undefined,
          extension: undefined,
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
        "Create a release note for a theme or extension. The product is written as theme:<id> or extension:<id>.",
      inputSchema: {
        product: z.string().describe("theme:<id> or extension:<id>."),
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
        if (!(await productExists(validated.data))) {
          throw new ToolError("The chosen theme or extension no longer exists.");
        }
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
        product: z.string().optional().describe("theme:<id> or extension:<id>."),
        version: z.string().max(CHANGELOG_LIMITS.version).optional(),
        title: z.string().max(CHANGELOG_LIMITS.title).optional(),
        releasedAt: z.string().optional(),
        changes: changesSchema.optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.changelogEntry.findUnique({
          where: { id: args.id },
          select: {
            id: true,
            themeId: true,
            extensionId: true,
            version: true,
            title: true,
            releasedAt: true,
            changes: true,
          },
        });
        if (!existing) throw new ToolError("Changelog entry not found.");

        const body = {
          product: args.product ?? productRef(existing.themeId, existing.extensionId),
          version: args.version ?? existing.version,
          title: args.title ?? existing.title,
          releasedAt: args.releasedAt ?? existing.releasedAt.toISOString(),
          changes: args.changes ?? readChanges(existing.changes),
        };

        const validated = validateChangelog(body);
        if ("error" in validated) throw new ToolError(validated.error);
        if (!(await productExists(validated.data))) {
          throw new ToolError("The chosen theme or extension no longer exists.");
        }

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
        const existing = await prisma.changelogEntry.findUnique({
          where: { id: args.id },
          select: { id: true },
        });
        if (!existing) throw new ToolError("Changelog entry not found.");
        await prisma.changelogEntry.delete({ where: { id: args.id } });
        return { id: args.id, deleted: true };
      }),
  );
}
