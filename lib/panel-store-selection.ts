import type { RequestStore, Store } from "./stores";

/** A known store domain is authoritative. Old central-panel cookies are only a fallback. */
export function selectPanelStore(match: RequestStore, chosen: string | undefined, stores: Store[]): Store {
  if (match.via !== "fallback") return match.store;
  return stores.find((store) => store.id === chosen) ?? match.store;
}
