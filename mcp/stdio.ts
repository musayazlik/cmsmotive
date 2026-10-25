import "./env";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpServerName } from "@/lib/mcp-settings";
import { listStores } from "@/lib/stores";
import { resolveMcpActor, setProcessStore } from "./context";
import { createCmsMcpServer } from "./create-server";

/**
 * Standalone MCP server over stdio, for Claude Desktop, Cursor, opencode and
 * other local MCP clients. Run it with `pnpm mcp`; it works on the store
 * named by MCP_STORE (a store key), else on the default store.
 */
async function main() {
  const stores = await listStores();
  const wanted = process.env.MCP_STORE?.trim();
  const store = wanted ? stores.find((candidate) => candidate.key === wanted) : (stores.find((candidate) => candidate.isDefault) ?? stores[0]);
  if (!store) throw new Error(wanted ? `No store has the key "${wanted}".` : "No store is configured; run the store seed.");
  setProcessStore(store.id);

  const [actor, name] = await Promise.all([resolveMcpActor(), getMcpServerName(store.id)]);
  console.error(`[${name}-mcp] store ${store.key}, acting as ${actor.email} (${actor.role})`);

  const server = createCmsMcpServer(name);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${name}-mcp] listening on stdio`);
}

main().catch((error) => {
  console.error("[cmsmotive-mcp] failed to start:", error);
  process.exit(1);
});
