import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * A validation or business-rule failure that is safe to show to the MCP
 * client. Anything else is treated as unexpected and logged on the server.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/** Serializes a tool result as pretty JSON so agents can read it directly. */
export async function runTool<T>(action: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await action();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) ?? "null" }],
    };
  } catch (error) {
    if (error instanceof ToolError) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    console.error("[mcp] tool failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Unexpected error: ${message}` }],
      isError: true,
    };
  }
}

export function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new ToolError(message);
  return value;
}

/** Dates are JSON serialized as ISO strings everywhere else in the panel. */
export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
