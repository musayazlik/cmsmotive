/**
 * Sections of the settings area, one page each under /panel/settings/<id>.
 * The sidebar's Settings group lists them in this order, the first entry is
 * where /panel/settings redirects. Add a section here, then render its panel
 * in [section]/page.tsx.
 */
export const SETTINGS_TABS = [
  { id: "legal", label: "Legal", intro: "Seller identity, privacy information, document versions and the release checklist." },
  {
    id: "general",
    label: "General",
    intro:
      "How the site introduces itself to search engines and link previews: the name, X account, contact address and social profiles in Open Graph, X cards and structured data.",
  },
  {
    id: "security",
    label: "Security",
    intro: "Choose a private address for team access and review the protections around administrator sign-in.",
  },
  {
    id: "seo",
    label: "SEO",
    intro:
      "Search engine visibility: indexing and robots.txt, custom header meta tags, the title suffix, the fallback link-preview image and the verification codes for Google, Bing and Yandex.",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    intro:
      "Welcome visitors with a maintenance page and collect email signups for your return. Your panel and signed-in access stay available.",
  },
  {
    id: "reviews",
    label: "Reviews",
    intro:
      "Moderation and spam protection for product reviews, and which of them the home page quotes as social proof.",
  },
  {
    id: "email",
    label: "Email",
    intro:
      "What the site sends and where it goes: the sender name, the inbox for inquiries, the contact form auto-reply and admin notifications.",
  },
  {
    id: "ai",
    label: "AI",
    intro:
      "Defaults the blog AI assistant opens with, so every draft starts from the model, tone and language you use most.",
  },
  {
    id: "telegram",
    label: "Telegram",
    intro:
      "Run the panel from Telegram: write and publish posts, generate or edit covers with AI and moderate reviews in plain words. The bot uses the same tools as MCP and only answers accounts you link.",
  },
  {
    id: "media",
    label: "Media",
    intro:
      "Choose UploadThing or Cloudflare R2 for this store’s product files, images and videos, and set image optimization defaults.",
  },
  {
    id: "appearance",
    label: "Appearance",
    intro:
      "Store brand colors, corner radius and typography tokens used across the site and page builder.",
  },
  {
    id: "mcp",
    label: "MCP",
    intro:
      "Let AI clients such as Claude, Cursor or opencode manage the panel through the Model Context Protocol. Every tool runs as the admin account picked here.",
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];
