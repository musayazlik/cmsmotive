import { cache } from "react";
import { DEFAULT_AI_SETTINGS, type AiSettings } from "@/lib/ai-settings-shared";
import {
  DEFAULT_EMAIL_SETTINGS,
  FALLBACK_CONTACT_RECIPIENT,
  type EmailSettings,
} from "@/lib/email-settings-shared";
import { DEFAULT_MAINTENANCE_SETTINGS, type MaintenanceSettings } from "@/lib/maintenance-settings-shared";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REVIEW_SETTINGS, type ReviewSettings } from "@/lib/review-settings-shared";
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from "@/lib/seo-settings-shared";
import { readSettingsGroup, writeSettingsGroup } from "@/lib/settings-store";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings-shared";
import {
  DEFAULT_UPLOAD_SETTINGS,
  WEBP_QUALITY_MAX,
  WEBP_QUALITY_MIN,
  type UploadSettings,
} from "@/lib/upload-settings-shared";

/**
 * Server-side access to the site settings stored in the Setting table as
 * string key-values. The client-safe contract (types + defaults) lives in
 * upload-settings-shared.ts — never import this module from a client
 * component, it pulls in the database client.
 */

const KEY_ENABLED = "upload.webp.enabled";
const KEY_QUALITY = "upload.webp.quality";
const SETTING_KEYS = [KEY_ENABLED, KEY_QUALITY];

export const getUploadSettings = cache(async (): Promise<UploadSettings> => {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const quality = Number.parseInt(values.get(KEY_QUALITY) ?? "", 10);
    return {
      convertWebp: (values.get(KEY_ENABLED) ?? String(DEFAULT_UPLOAD_SETTINGS.convertWebp)) === "true",
      webpQuality: Number.isFinite(quality)
        ? Math.min(WEBP_QUALITY_MAX, Math.max(WEBP_QUALITY_MIN, quality))
        : DEFAULT_UPLOAD_SETTINGS.webpQuality,
    };
  } catch {
    return DEFAULT_UPLOAD_SETTINGS;
  }
});

export async function saveUploadSettings(settings: UploadSettings): Promise<void> {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: KEY_ENABLED },
      update: { value: String(settings.convertWebp) },
      create: { key: KEY_ENABLED, value: String(settings.convertWebp) },
    }),
    prisma.setting.upsert({
      where: { key: KEY_QUALITY },
      update: { value: String(settings.webpQuality) },
      create: { key: KEY_QUALITY, value: String(settings.webpQuality) },
    }),
  ]);
}

/* ------------------------------------------------ JSON-encoded setting groups */

export const getSiteSettings = cache(() => readSettingsGroup("site", DEFAULT_SITE_SETTINGS));
export const saveSiteSettings = (settings: SiteSettings) => writeSettingsGroup("site", settings);

export const getSeoSettings = cache(() => readSettingsGroup("seo", DEFAULT_SEO_SETTINGS));
export const saveSeoSettings = (settings: SeoSettings) => writeSettingsGroup("seo", settings);

export const getReviewSettings = cache(() => readSettingsGroup("reviews", DEFAULT_REVIEW_SETTINGS));
export const saveReviewSettings = (settings: ReviewSettings) => writeSettingsGroup("reviews", settings);

export const getEmailSettings = cache(() => readSettingsGroup("email", DEFAULT_EMAIL_SETTINGS));
export const saveEmailSettings = (settings: EmailSettings) => writeSettingsGroup("email", settings);

export const getAiSettings = cache(() => readSettingsGroup("ai", DEFAULT_AI_SETTINGS));
export const saveAiSettings = (settings: AiSettings) => writeSettingsGroup("ai", settings);

export const getMaintenanceSettings = cache(() => readSettingsGroup("maintenance", DEFAULT_MAINTENANCE_SETTINGS));
export const saveMaintenanceSettings = (settings: MaintenanceSettings) => writeSettingsGroup("maintenance", settings);

/** The inbox that receives inquiries and notifications: the setting, the environment, then the fallback. */
export function contactRecipient(settings: EmailSettings): string {
  return settings.contactRecipient || process.env.PLUNK_CONTACT_TO_EMAIL || FALLBACK_CONTACT_RECIPIENT;
}
