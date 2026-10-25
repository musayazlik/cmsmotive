import { cookies, headers } from "next/headers";
import { cache } from "react";
import { currentStore } from "./current-store";
import { listStores, resolveRequestStore, storeOriginFrom, type Store } from "./stores";

/**
 * The store the panel is editing. One panel manages every store: the choice
 * is kept in a cookie (set by the store switcher), and without one the panel
 * edits the store whose domain it was opened on. Every panel page, action and
 * admin API reads and writes through this store only.
 */
export const PANEL_STORE_COOKIE = "panel-store";

export const panelStore = cache(async (): Promise<Store> => {
  const chosen = (await cookies()).get(PANEL_STORE_COOKIE)?.value;
  const store = chosen ? (await listStores()).find((candidate) => candidate.id === chosen) : undefined;
  return store ?? (await currentStore()).store;
});

/** panelStore() for route handlers that only hold the request (upload middleware). */
export async function panelStoreFromRequest(request: Request): Promise<Store> {
  const chosen = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === PANEL_STORE_COOKIE)?.[1];
  const store = chosen ? (await listStores()).find((candidate) => candidate.id === decodeURIComponent(chosen)) : undefined;
  return store ?? (await resolveRequestStore(request)).store;
}

/** Public origin of the panel's store, for "view site" links and previews. */
export async function panelStoreOrigin(): Promise<string> {
  return storeOriginFrom(await panelStore(), await headers());
}
