import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ADMIN_ACCESS_SETTINGS, validateAdminAccessSettings, type AdminAccessSettings } from "@/lib/admin-access-shared";

/** Security configuration fails closed on database errors instead of silently reopening the old address. */
export const getAdminAccessSettings = cache(async (): Promise<AdminAccessSettings> => {
  const row = await prisma.setting.findUnique({ where: { key: "security.panelPath" }, select: { value: true } });
  if (!row) return DEFAULT_ADMIN_ACCESS_SETTINGS;
  const parsed = validateAdminAccessSettings({ panelPath: JSON.parse(row.value) });
  if ("error" in parsed) throw new Error("Invalid admin access configuration.");
  return parsed.data;
});

/** Install-wide: one panel serves every store, so its entry lives in the shared Setting table. */
export async function saveAdminAccessSettings(settings: AdminAccessSettings) {
  const value = JSON.stringify(settings.panelPath);
  await prisma.setting.upsert({ where: { key: "security.panelPath" }, update: { value }, create: { key: "security.panelPath", value } });
}
