import { cache } from "react";
import { DEFAULT_AI_SETTINGS, type AiSettings } from "@/lib/ai-settings-shared";
import { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from "@/lib/email-settings-shared";
import { DEFAULT_MAINTENANCE_SETTINGS, type MaintenanceSettings } from "@/lib/maintenance-settings-shared";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REVIEW_SETTINGS, type ReviewSettings } from "@/lib/review-settings-shared";
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from "@/lib/seo-settings-shared";
import { readSettingsGroup, readStoreValues, upsertStoreValue, writeSettingsGroup } from "@/lib/settings-store";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings-shared";
import {
  DEFAULT_UPLOAD_SETTINGS,
  WEBP_QUALITY_MAX,
  WEBP_QUALITY_MIN,
  type UploadSettings,
} from "@/lib/upload-settings-shared";

/**
 * Server-side access to a store's settings (StoreSetting): every getter and
 * saver takes the store id, and each store keeps its own values. The
 * client-safe contracts (types + defaults) live in lib/*-settings-shared.ts —
 * never import this module from a client component, it pulls in the
 * database client.
 */

const KEY_ENABLED = "upload.webp.enabled";
const KEY_QUALITY = "upload.webp.quality";
const SETTING_KEYS = [KEY_ENABLED, KEY_QUALITY];

export const getUploadSettings = cache(async (storeId: string): Promise<UploadSettings> => {
  try {
    const values = await readStoreValues(storeId, SETTING_KEYS);
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

export async function saveUploadSettings(storeId: string, settings: UploadSettings): Promise<void> {
  await prisma.$transaction([
    upsertStoreValue(storeId, KEY_ENABLED, String(settings.convertWebp)),
    upsertStoreValue(storeId, KEY_QUALITY, String(settings.webpQuality)),
  ]);
}

/* ------------------------------------------------ JSON-encoded setting groups */

export const getSiteSettings = cache((storeId: string) => readSettingsGroup(storeId, "site", DEFAULT_SITE_SETTINGS));
export const saveSiteSettings = (storeId: string, settings: SiteSettings) => writeSettingsGroup(storeId, "site", settings);

export const getSeoSettings = cache((storeId: string) => readSettingsGroup(storeId, "seo", DEFAULT_SEO_SETTINGS));
export const saveSeoSettings = (storeId: string, settings: SeoSettings) => writeSettingsGroup(storeId, "seo", settings);

export const getReviewSettings = cache((storeId: string) => readSettingsGroup(storeId, "reviews", DEFAULT_REVIEW_SETTINGS));
export const saveReviewSettings = (storeId: string, settings: ReviewSettings) => writeSettingsGroup(storeId, "reviews", settings);

export const getEmailSettings = cache((storeId: string) => readSettingsGroup(storeId, "email", DEFAULT_EMAIL_SETTINGS));
export const saveEmailSettings = (storeId: string, settings: EmailSettings) => writeSettingsGroup(storeId, "email", settings);

export const getAiSettings = cache((storeId: string) => readSettingsGroup(storeId, "ai", DEFAULT_AI_SETTINGS));
export const saveAiSettings = (storeId: string, settings: AiSettings) => writeSettingsGroup(storeId, "ai", settings);

export const getMaintenanceSettings = cache((storeId: string) => readSettingsGroup(storeId, "maintenance", DEFAULT_MAINTENANCE_SETTINGS));
export const saveMaintenanceSettings = (storeId: string, settings: MaintenanceSettings) => writeSettingsGroup(storeId, "maintenance", settings);

/** The inbox that receives a store's inquiries and notifications: its setting, then the environment. */
export function contactRecipient(settings: EmailSettings): string {
  return settings.contactRecipient || process.env.PLUNK_CONTACT_TO_EMAIL || "";
}
