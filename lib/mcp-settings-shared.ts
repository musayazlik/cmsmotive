/**
 * Client-safe MCP settings contract shared by the settings page and its
 * forms. Lives apart from lib/mcp-settings.ts so browser bundles never pull
 * in the database client.
 */

/** Issued tokens start with this so they are recognisable in configs and leak scanners. */
export const MCP_TOKEN_PREFIX = "cmsm_";

/** Default display name of the server in MCP clients. */
export const DEFAULT_MCP_NAME = "cmsmotive";

export const MCP_NAME_MAX_LENGTH = 40;

const MCP_NAME_PATTERN = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]{0,${MCP_NAME_MAX_LENGTH - 1}}$`);

export const MCP_NAME_ERROR = `Use 1–${MCP_NAME_MAX_LENGTH} characters: letters, numbers, dots, dashes or underscores, starting with a letter or number.`;

/**
 * Normalizes a user-chosen server name. The value becomes a key in JSON
 * client configs and an argument to `claude mcp add`, so keep it free of
 * spaces and punctuation that those consumers could reject.
 */
export function normalizeMcpName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return MCP_NAME_PATTERN.test(name) ? name : null;
}

export type McpTokenInfo = {
  /** Last characters of the token, the only part kept in readable form. */
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type McpSettings = {
  /** Name clients use for this server, shown in their configs and the initialize response. */
  name: string;
  /** Serve the token-protected POST /api/mcp endpoint. */
  httpEnabled: boolean;
  /** Admin account MCP writes are attributed to; null = the oldest admin. */
  actorUserId: string | null;
  /** The current HTTP access token, or null when none was issued. */
  token: McpTokenInfo | null;
};

export const DEFAULT_MCP_SETTINGS: McpSettings = {
  name: DEFAULT_MCP_NAME,
  httpEnabled: false,
  actorUserId: null,
  token: null,
};
