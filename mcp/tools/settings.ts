import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AI_DEPTHS, AI_LANGUAGES, AI_STYLES } from "@/app/panel/blog/_ai";
import { INLINE_CITATIONS, validateAiSettings } from "@/lib/ai-settings-shared";
import { validateEmailSettings } from "@/lib/email-settings-shared";
import { validateReviewSettings } from "@/lib/review-settings-shared";
import {
  getAiSettings,
  getEmailSettings,
  getReviewSettings,
  getSeoSettings,
  getSiteSettings,
  getUploadSettings,
  saveAiSettings,
  saveEmailSettings,
  saveReviewSettings,
  saveSeoSettings,
  saveSiteSettings,
  saveUploadSettings,
} from "@/lib/settings";
import { validateSeoSettings } from "@/lib/seo-settings-shared";
import { validateSiteSettings } from "@/lib/site-settings-shared";
import {
  WEBP_QUALITY_MAX,
  WEBP_QUALITY_MIN,
} from "@/lib/upload-settings-shared";
import { runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

/**
 * Registers `settings_update_<group>` for a JSON settings group: omitted
 * fields keep their current values, and the merged result goes through the
 * same validator as the panel form. MCP access itself (token, actor) is
 * deliberately not exposed, so a client cannot widen its own access.
 */
function registerGroupUpdate<T extends Record<string, unknown>>(
  server: McpServer,
  group: string,
  title: string,
  description: string,
  inputSchema: z.ZodRawShape,
  get: (storeId: string) => Promise<T>,
  validate: (input: Record<string, unknown>) => { error: string } | { data: T },
  save: (storeId: string, data: T) => Promise<void>,
) {
  server.registerTool(
    `settings_update_${group}`,
    { title, description: `${description} Omitted fields keep their current values.`, inputSchema, annotations: { destructiveHint: false } },
    async (args) =>
      runTool(async () => {
        const changes = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
        if (Object.keys(changes).length === 0) throw new ToolError("Nothing to update. Provide at least one field.");
        const parsed = validate({ ...(await get(mcpStoreId())), ...changes });
        if ("error" in parsed) throw new ToolError(parsed.error);
        await save(mcpStoreId(), parsed.data);
        return { [group]: parsed.data };
      }),
  );
}

export function registerSettingsTools(server: McpServer) {
  server.registerTool(
    "settings_get",
    {
      title: "Get site settings",
      description:
        "Return this store's panel settings: upload optimizer, site identity, SEO (indexing, title suffix, share image, verification), review moderation, e-mail and AI assistant defaults.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runTool(async () => {
        const storeId = mcpStoreId();
        const [upload, site, seo, reviews, email, ai] = await Promise.all([
          getUploadSettings(storeId),
          getSiteSettings(storeId),
          getSeoSettings(storeId),
          getReviewSettings(storeId),
          getEmailSettings(storeId),
          getAiSettings(storeId),
        ]);
        return { upload, site, seo, reviews, email, ai };
      }),
  );

  server.registerTool(
    "settings_update",
    {
      title: "Update upload settings",
      description:
        "Update upload settings. Omitted fields keep their current values. Quality must be an integer between 40 and 100.",
      inputSchema: {
        convertWebp: z.boolean().optional(),
        webpQuality: z.number().int().min(WEBP_QUALITY_MIN).max(WEBP_QUALITY_MAX).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        if (args.convertWebp === undefined && args.webpQuality === undefined) {
          throw new ToolError("Nothing to update. Provide convertWebp or webpQuality.");
        }
        const current = await getUploadSettings(mcpStoreId());
        const next = {
          convertWebp: args.convertWebp ?? current.convertWebp,
          webpQuality: args.webpQuality ?? current.webpQuality,
        };
        if (
          !Number.isInteger(next.webpQuality) ||
          next.webpQuality < WEBP_QUALITY_MIN ||
          next.webpQuality > WEBP_QUALITY_MAX
        ) {
          throw new ToolError(
            `Quality must be between ${WEBP_QUALITY_MIN} and ${WEBP_QUALITY_MAX}.`,
          );
        }
        await saveUploadSettings(mcpStoreId(), next);
        return { upload: next };
      }),
  );

  registerGroupUpdate(
    server,
    "site",
    "Update site identity",
    "Site name, X handle, public contact e-mail and social profile URLs used in Open Graph, X cards and JSON-LD. socialProfiles replaces the whole list (https URLs, at most 8). systemLanguage sets the panel assistant language.",
    {
      siteName: z.string().optional(),
      twitterHandle: z.string().optional().describe('X handle such as "@cmsmotive"; "" removes it.'),
      contactEmail: z.string().optional().describe('"" removes it.'),
      socialProfiles: z.array(z.string()).optional(),
      systemLanguage: z.enum(["en", "de", "tr"]).optional().describe("Language of the panel assistant chat."),
    },
    getSiteSettings,
    validateSiteSettings,
    saveSiteSettings,
  );

  registerGroupUpdate(
    server,
    "seo",
    "Update SEO settings",
    "indexing=false hides the whole public site from search engines (robots.txt disallow + noindex) — only for staging. titleSuffix is appended to page titles (e.g. \" — CMSMotive\", \"\" for none). shareImageUrl/shareImageId set the fallback link-preview image (\"\" = built-in). robotsDisallow replaces the extra Disallow paths. *Verification take the search console codes.",
    {
      indexing: z.boolean().optional(),
      titleSuffix: z.string().optional(),
      shareImageUrl: z.string().optional(),
      shareImageId: z.string().optional(),
      robotsDisallow: z.array(z.string()).optional(),
      googleVerification: z.string().optional(),
      bingVerification: z.string().optional(),
      yandexVerification: z.string().optional(),
    },
    getSeoSettings,
    validateSeoSettings,
    saveSeoSettings,
  );

  registerGroupUpdate(
    server,
    "reviews",
    "Update review settings",
    "Review moderation and spam protection: autoApprove publishes new reviews immediately, perHour (1–50) limits submissions per e-mail address, minCaptchaScore (0.1–0.9) is the reCAPTCHA threshold, showcase/showcaseMinRating (1–5) control the home page quotes.",
    {
      autoApprove: z.boolean().optional(),
      perHour: z.number().int().optional(),
      minCaptchaScore: z.number().optional(),
      showcase: z.boolean().optional(),
      showcaseMinRating: z.number().int().optional(),
    },
    getReviewSettings,
    validateReviewSettings,
    saveReviewSettings,
  );

  registerGroupUpdate(
    server,
    "email",
    "Update e-mail settings",
    'Sender display name, the inbox for inquiries and notifications (contactRecipient, "" = environment default), the contact form auto-reply and admin notifications for new reviews and newsletter subscribers.',
    {
      senderName: z.string().optional(),
      contactRecipient: z.string().optional(),
      contactAutoReply: z.boolean().optional(),
      notifyReviews: z.boolean().optional(),
      notifySubscribers: z.boolean().optional(),
    },
    getEmailSettings,
    validateEmailSettings,
    saveEmailSettings,
  );

  registerGroupUpdate(
    server,
    "ai",
    "Update AI assistant defaults",
    'Defaults the blog AI dialog opens with. textModel/imageModel are OpenRouter model ids ("" = automatic choice).',
    {
      textModel: z.string().optional(),
      imageModel: z.string().optional(),
      style: z.enum(AI_STYLES).optional(),
      depth: z.enum(AI_DEPTHS).optional(),
      language: z.enum(AI_LANGUAGES).optional(),
      webSearch: z.boolean().optional(),
      researchModel: z
        .string()
        .optional()
        .describe('"" = Perplexity Sonar Pro, "native" = the content model\'s own web search, or a Perplexity model id.'),
      inlineCitations: z
        .enum(INLINE_CITATIONS)
        .optional()
        .describe("Source numbers in the text: none = bibliography only, light = at most one per paragraph."),
    },
    getAiSettings,
    validateAiSettings,
    saveAiSettings,
  );
}
