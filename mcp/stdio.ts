import "./env";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpServerName } from "@/lib/mcp-settings";
import { resolveMcpActor } from "./context";
import { createCmsMcpServer } from "./create-server";

/**
 * Standalone MCP server over stdio, for Claude Desktop, Cursor, opencode and
 * other local MCP clients. Run it with `pnpm mcp`.
 */
async function main() {
  const [actor, name] = await Promise.all([resolveMcpActor(), getMcpServerName()]);
  console.error(`[${name}-mcp] acting as ${actor.email} (${actor.role})`);

  const server = createCmsMcpServer(name);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${name}-mcp] listening on stdio`);
}

main().catch((error) => {
  console.error("[cmsmotive-mcp] failed to start:", error);
  process.exit(1);
});
