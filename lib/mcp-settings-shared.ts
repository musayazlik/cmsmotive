/**
 * Client-safe MCP settings contract shared by the settings page and its
 * forms. Lives apart from lib/mcp-settings.ts so browser bundles never pull
 * in the database client.
 */

/** Issued tokens start with this so they are recognisable in configs and leak scanners. */
export const MCP_TOKEN_PREFIX = "cmsm_";

export type McpTokenInfo = {
  /** Last characters of the token, the only part kept in readable form. */
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type McpSettings = {
  /** Serve the token-protected POST /api/mcp endpoint. */
  httpEnabled: boolean;
  /** Admin account MCP writes are attributed to; null = the oldest admin. */
  actorUserId: string | null;
  /** The current HTTP access token, or null when none was issued. */
  token: McpTokenInfo | null;
};

export const DEFAULT_MCP_SETTINGS: McpSettings = { httpEnabled: false, actorUserId: null, token: null };
