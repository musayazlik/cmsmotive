import { cache } from "react";
import { prisma } from "@/lib/prisma";
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
