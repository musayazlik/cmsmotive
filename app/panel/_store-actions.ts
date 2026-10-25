"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { PANEL_STORE_COOKIE } from "@/lib/panel-store";
import { listStores } from "@/lib/stores";

/** Switches the store the whole panel edits (lib/panel-store.ts). */
export async function switchPanelStore(storeId: string): Promise<{ ok: boolean; error?: string }> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };
  if (!(await listStores()).some((store) => store.id === storeId)) return { ok: false, error: "Unknown store." };

  (await cookies()).set(PANEL_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/panel", "layout");
  return { ok: true };
}
