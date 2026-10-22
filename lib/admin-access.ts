import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { writeSettingsGroup } from "@/lib/settings-store";
import { DEFAULT_ADMIN_ACCESS_SETTINGS, validateAdminAccessSettings, type AdminAccessSettings } from "@/lib/admin-access-shared";

/** Security configuration fails closed on database errors instead of silently reopening the old address. */
export const getAdminAccessSettings = cache(async (): Promise<AdminAccessSettings> => {
  const row = await prisma.setting.findUnique({ where: { key: "security.panelPath" }, select: { value: true } });
  if (!row) return DEFAULT_ADMIN_ACCESS_SETTINGS;
  const parsed = validateAdminAccessSettings({ panelPath: JSON.parse(row.value) });
  if ("error" in parsed) throw new Error("Invalid admin access configuration.");
  return parsed.data;
});

export const saveAdminAccessSettings = (settings: AdminAccessSettings) => writeSettingsGroup("security", settings);
