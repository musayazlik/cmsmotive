"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-guard";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { listStores, storePanelHref } from "@/lib/stores";
import { issueStoreSessionTransfer } from "@/lib/store-session-transfer";

/** Resolve a registered store's panel address; the client navigates across origins. */
export async function switchPanelStore(storeId: string): Promise<{ ok: true; href: string; token: string } | { ok: false; error: string }> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };
  const store = (await listStores()).find((candidate) => candidate.id === storeId);
  if (!store) return { ok: false, error: "Unknown store." };

  const { panelPath } = await getAdminAccessSettings();
  const href = storePanelHref(store, await headers(), panelPath);
  if (!href) return { ok: false, error: "Add a domain to this store before switching to it." };
  const transfer = await issueStoreSessionTransfer(await headers(), storeId, href);
  if (!transfer) return { ok: false, error: "You do not have access to this store." };
  return { ok: true, ...transfer };
}
