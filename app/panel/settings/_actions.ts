"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { saveUploadSettings } from "@/lib/settings";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN } from "@/lib/upload-settings-shared";
import type { ActionResult } from "@/app/panel/media/_lib";

/**
 * Persists the upload-optimization settings. Re-checked against the admin
 * role because server actions are reachable endpoints, unlike the page
 * layout guard.
 */
export async function saveUploadSettingsAction(
  convertWebp: boolean,
  webpQuality: number,
): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  if (!Number.isInteger(webpQuality) || webpQuality < WEBP_QUALITY_MIN || webpQuality > WEBP_QUALITY_MAX) {
    return { ok: false, error: `Quality must be between ${WEBP_QUALITY_MIN} and ${WEBP_QUALITY_MAX}.` };
  }

  try {
    await saveUploadSettings({ convertWebp, webpQuality });
    revalidatePath("/panel/settings");
    return { ok: true };
  } catch (error) {
    console.error("saveUploadSettingsAction failed", error);
    return { ok: false, error: "The settings could not be saved." };
  }
}
