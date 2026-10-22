/**
 * Tool modes. Every tool definition is sent with every agent step, so the bot
 * offers one group of MCP tools at a time instead of all of them. The user
 * switches with a command (/post, /site, …) and the mode sticks to the chat.
 * Each mode has its own prompt cache: the first message after a switch is
 * billed in full, later ones read the cache again.
 */

type ModeInfo = {
  title: string;
  /** What the mode's tools cover, for the help text and the system prompt. */
  summary: string;
  /** MCP tool name prefixes; "" matches every tool. */
  prefixes: string[];
};

export const TOOL_MODES = {
  general: {
    title: "General",
    summary: "posts, media, AI writing, reviews, inbox and stats",
    prefixes: ["blog_", "media_", "ai_", "stats_", "inbox_", "reviews_", "notifications_"],
  },
  post: {
    title: "Posts",
    summary: "posts, categories, tags, media and AI writing",
    prefixes: ["blog_", "media_", "ai_"],
  },
  reviews: {
    title: "Reviews",
    summary: "theme and extension reviews, the contact inbox and notifications",
    prefixes: ["reviews_", "inbox_", "notifications_"],
  },
  stats: {
    title: "Stats",
    summary: "site statistics and notifications",
    prefixes: ["stats_", "notifications_"],
  },
  site: {
    title: "Site",
    summary: "themes, extensions, settings, users and the changelog",
    prefixes: ["themes_", "extensions_", "settings_", "users_", "changelog_"],
  },
  all: {
    title: "All",
    summary: "every panel tool (largest prompt)",
    prefixes: [""],
  },
} satisfies Record<string, ModeInfo>;

export type ToolMode = keyof typeof TOOL_MODES;

export const DEFAULT_MODE: ToolMode = "general";

export function isToolMode(value: unknown): value is ToolMode {
  return typeof value === "string" && Object.hasOwn(TOOL_MODES, value);
}

/** account_info is offered in every mode: the bot can always say who it acts as. */
export function toolInMode(mode: ToolMode, name: string): boolean {
  return name.startsWith("account_") || TOOL_MODES[mode].prefixes.some((prefix) => name.startsWith(prefix));
}

/** The command menu Telegram shows next to the message field. */
export const BOT_COMMANDS = [
  { command: "new", description: "Start a fresh conversation" },
  ...Object.entries(TOOL_MODES).map(([command, info]) => ({
    command,
    description: `${info.title} mode: ${info.summary}`,
  })),
  { command: "whoami", description: "Panel account the bot acts as" },
  { command: "help", description: "What the bot can do" },
];
