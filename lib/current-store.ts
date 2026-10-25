import { headers } from "next/headers";
import { cache } from "react";
import { listStores, resolveRequestStore, storeOriginFrom, type RequestStore } from "./stores";

/** Store the current request was addressed to (see lib/stores.ts). Pages, route handlers and actions only. */
export const currentStore = cache(async (): Promise<RequestStore> => resolveRequestStore(await headers()));

/** Id of the public store serving this request. The panel uses panelStore() instead. */
export async function currentStoreId(): Promise<string> {
  return (await currentStore()).store.id;
}

/** Public origin of any store as seen from this request: the request's own canonical origin when it is that store. */
export async function originOfStore(storeId: string): Promise<string> {
  const { store, origin } = await currentStore();
  if (store.id === storeId) return origin;
  const target = (await listStores()).find((candidate) => candidate.id === storeId);
  return target ? storeOriginFrom(target, await headers()) : origin;
}
