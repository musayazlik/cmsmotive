import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_MCP_NAME } from "@/lib/mcp-settings-shared";
import { registerAiTools } from "./tools/ai";
import { registerChangelogTools } from "./tools/changelog";
import { registerExtensionTools } from "./tools/extensions";
import { registerInboxTools } from "./tools/inbox";
import { registerMediaTools } from "./tools/media";
import { registerPostTools } from "./tools/posts";
import { registerReviewTools } from "./tools/reviews";
import { registerSettingsTools } from "./tools/settings";
import { registerStatsTools } from "./tools/stats";
import { registerTaxonomyTools } from "./tools/taxonomy";
import { registerThemeTools } from "./tools/themes";
import { registerUserTools } from "./tools/users";

/**
 * Builds the MCP server with every panel capability. The same instance is
 * used by the stdio entry point (mcp/stdio.ts) and the token-protected HTTP
 * route (app/api/mcp/route.ts).
 */
export function createCmsMcpServer(name = DEFAULT_MCP_NAME): McpServer {
  const server = new McpServer(
    { name, version: "0.1.0" },
    {
      instructions:
        "Manage the CMSMotive panel. Use list tools first to discover ids, then create/update/delete tools. Publishing a blog post requires a category and at least one tag. Destructive tools are marked and cannot be undone.",
    },
  );

  registerPostTools(server);
  registerTaxonomyTools(server);
  registerThemeTools(server);
  registerExtensionTools(server);
  registerChangelogTools(server);
  registerMediaTools(server);
  registerReviewTools(server);
  registerInboxTools(server);
  registerUserTools(server);
  registerStatsTools(server);
  registerSettingsTools(server);
  registerAiTools(server);

  return server;
}
