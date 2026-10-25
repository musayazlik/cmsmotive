import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { activityStep, trackActivity } from "@/lib/assistant-activity";
import { mcpStoreId } from "./context";

/** Instrument registrations once so HTTP, stdio and Telegram use the same tracking. */
export function instrumentMcpActivity(server: McpServer, authorize?: () => Promise<unknown>): void {
  const register = server.registerTool.bind(server);
  server.registerTool = (name, config, callback) => {
    const tool = register(name, config, callback);
    const handler = tool.handler;
    if (typeof handler === "function") {
      tool.handler = (...args: Parameters<typeof handler>) => trackActivity({
        storeId: mcpStoreId(), source: "mcp", title: config.title ?? name,
      }, async () => {
        await authorize?.();
        const result = await Reflect.apply(handler, server, args) as CallToolResult;
        if (result.isError) await activityStep("This step failed. Check the source conversation or tool response.", { failed: true });
        else await activityStep(`${config.title ?? name}: completed.`);
        return result;
      });
    }
    return tool;
  };
}
