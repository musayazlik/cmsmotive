import { cookies, headers } from "next/headers";
import { cache } from "react";
import { currentStore } from "./current-store";
import { listStores, resolveRequestStore, storeOriginFrom, type Store } from "./stores";
import { selectPanelStore } from "./panel-store-selection";

/**
 * The store the panel is editing. Registered domains and development aliases
 * select their own store. Legacy central-panel cookies apply only on fallback
 * hosts. Every panel page, action and admin API shares this resolution.
 */
export const PANEL_STORE_COOKIE = "panel-store";

export const panelStore = cache(async (): Promise<Store> => {
  const match = await currentStore();
  if (match.via !== "fallback") return match.store;
  const chosen = (await cookies()).get(PANEL_STORE_COOKIE)?.value;
  return selectPanelStore(match, chosen, chosen ? await listStores() : []);
});

/** panelStore() for route handlers that only hold the request (upload middleware). */
export async function panelStoreFromRequest(request: Request): Promise<Store> {
  const match = await resolveRequestStore(request);
  if (match.via !== "fallback") return match.store;
  const chosen = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === PANEL_STORE_COOKIE)?.[1];
  let decoded: string | undefined;
  try { decoded = chosen ? decodeURIComponent(chosen) : undefined; } catch { /* Ignore malformed legacy cookies. */ }
  return selectPanelStore(match, decoded, decoded ? await listStores() : []);
}

/** Public origin of the panel's store, for "view site" links and previews. */
export async function panelStoreOrigin(): Promise<string> {
  return storeOriginFrom(await panelStore(), await headers());
}
