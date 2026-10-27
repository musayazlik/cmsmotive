import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listStorePages, loadPageLocale, publishPage, saveDraft } from "@/lib/page-builder/pages";
import { resolveMcpActor } from "../context";
import { iso, runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

/**
 * Builder page tools (Faz 4): read pages and their language versions, write a
 * validated draft through the single write path and publish. Scheduling and
 * revisions stay panel-only for now.
 */
export function registerPageTools(server: McpServer) {
  server.registerTool(
    "pages_list",
    {
      title: "List builder pages",
      description:
        "List the visual-editor pages of the store with every language version and its publication status.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runTool(async () => {
        const rows = await listStorePages(mcpStoreId());
        return rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          kind: row.kind,
          updatedAt: iso(row.updatedAt),
          locales: row.locales.map((locale) => ({
            locale: locale.locale,
            title: locale.title,
            status: locale.status,
            publishedAt: iso(locale.publishedAt),
            publishAt: iso(locale.publishAt),
          })),
        }));
      }),
  );

  server.registerTool(
    "page_get",
    {
      title: "Read a builder page version",
      description: "Return one language version of a builder page, including its draft and published documents.",
      inputSchema: {
        pageId: z.string().describe("Page id from pages_list."),
        locale: z.string().describe("Language code, e.g. en."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ pageId, locale }) =>
      runTool(async () => {
        const loaded = await loadPageLocale(mcpStoreId(), pageId, locale);
        if (!loaded?.locale) throw new ToolError("Page or language version not found.");
        return {
          page: loaded.page,
          locale: {
            title: loaded.locale.title,
            status: loaded.locale.status,
            version: loaded.locale.version,
            publishedAt: iso(loaded.locale.publishedAt),
            publishAt: iso(loaded.locale.publishAt),
            draft: loaded.locale.draft,
            published: loaded.locale.published,
          },
        };
      }),
  );

  server.registerTool(
    "page_update_draft",
    {
      title: "Update a builder page draft",
      description:
        "Replace the draft document of one language version. The document must be a valid Puck document ({ root, content }). Send the version you read; a stale version is rejected with 409-style text so two writers never overwrite each other.",
      inputSchema: {
        pageId: z.string(),
        locale: z.string(),
        expectedVersion: z.number().int().min(0).describe("The version field from page_get."),
        doc: z.unknown().describe("The full Puck document: { root: { props: {} }, content: [ ... ] }."),
      },
    },
    async ({ pageId, locale, expectedVersion, doc }) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        const result = await saveDraft(mcpStoreId(), pageId, locale, doc, expectedVersion, actor.id);
        if (!result.ok) {
          throw new ToolError(
            result.conflict
              ? `Version conflict: the draft is now at version ${result.currentVersion}. Read it again with page_get.`
              : result.error,
          );
        }
        return { ok: true, version: result.version };
      }),
  );

  server.registerTool(
    "page_publish",
    {
      title: "Publish a builder page version",
      description:
        "Publish the saved draft of one language version. An accessibility check runs first; blockers fail the tool.",
      inputSchema: {
        pageId: z.string(),
        locale: z.string(),
      },
    },
    async ({ pageId, locale }) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        const result = await publishPage(mcpStoreId(), pageId, locale, { userId: actor.id, note: "Published via MCP" });
        if (!result.ok) {
          throw new ToolError([result.error, ...(result.blockers ?? [])].filter(Boolean).join(" "));
        }
        return { ok: true, warnings: result.warnings, publishedAt: iso(result.publishedAt), version: result.version };
      }),
  );
}
