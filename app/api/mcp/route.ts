import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpServerName, verifyMcpToken } from "@/lib/mcp-settings";
import { resolveMcpActor, runInStore } from "@/mcp/context";
import { createCmsMcpServer } from "@/mcp/create-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streamable HTTP MCP endpoint. Stateless: every POST builds a fresh server
 * and transport, which works in serverless deployments. Switched on, and its
 * access token issued, under Settings → MCP; the actor is still resolved to
 * an admin panel account before a request is served.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
} as const;

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function errorResponse(message: string, status: number): Response {
  return withCors(Response.json({ error: message }, { status }));
}

export async function POST(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  const check = await verifyMcpToken(provided);
  if (check.result === "disabled") {
    return errorResponse("The MCP HTTP endpoint is disabled. Turn it on under Settings → MCP.", 503);
  }
  if (check.result === "no-token") {
    return errorResponse("No MCP access token has been issued. Create one under Settings → MCP.", 503);
  }
  if (check.result !== "ok") return errorResponse("Unauthorized.", 401);
  const { storeId } = check;

  try {
    await runInStore(storeId, resolveMcpActor);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "The MCP user could not be resolved.",
      403,
    );
  }

  // Every tool of this request works on the token's store.
  const server = createCmsMcpServer(await getMcpServerName(storeId));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const response = await runInStore(storeId, () => transport.handleRequest(request));
  return withCors(response);
}

export function GET(): Response {
  return errorResponse("Method not allowed. Send MCP JSON-RPC requests with POST.", 405);
}

export function DELETE(): Response {
  return errorResponse("Method not allowed. This endpoint is stateless.", 405);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
