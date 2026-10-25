import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n/config";
import { prisma } from "./prisma";

/**
 * Storefronts (tenants) are rows of the Store table, created by the seed and
 * the panel; code never names one. A request belongs to the store owning its
 * host (StoreDomain).
 *
 * - In development `<key>.localhost` reaches the store with that key, since
 *   browsers resolve *.localhost to this machine: run the dev server and open
 *   `http://<key>.localhost:<PORT>` to preview a store locally.
 * - Hosts no domain matches (localhost, the server IP) get the default store.
 */
export type Store = {
  id: string;
  key: string;
  name: string;
  /** Served at unprefixed URLs. */
  defaultLocale: Locale;
  /** Every published locale, defaultLocale included. */
  locales: Locale[];
  isDefault: boolean;
  /** Domain hostnames, canonical first. */
  hosts: string[];
};

export type RequestStore = {
  store: Store;
  /** How the host was matched: a store domain, `<key>.localhost` in development, or the default store. */
  via: "domain" | "dev-alias" | "fallback";
  /** Canonical origin for the request's links, sitemap and emails. */
  origin: string;
};

/** Stores change rarely; the panel calls invalidateStores() after an edit. */
const CACHE_TTL = 30_000;
let cached: { at: number; stores: Promise<Store[]> } | null = null;

export function listStores(): Promise<Store[]> {
  if (!cached || Date.now() - cached.at > CACHE_TTL) {
    const stores = loadStores();
    cached = { at: Date.now(), stores };
    // A failed query must not stick for the whole TTL.
    stores.catch(() => {
      if (cached?.stores === stores) cached = null;
    });
  }
  return cached.stores;
}

export function invalidateStores() {
  cached = null;
}

async function loadStores(): Promise<Store[]> {
  const rows = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    include: { domains: { orderBy: [{ primary: "desc" }, { createdAt: "asc" }] } },
  });
  return rows.map((row) => {
    const locales = row.locales.filter(isLocale);
    const defaultLocale = isLocale(row.defaultLocale) ? row.defaultLocale : (locales[0] ?? DEFAULT_LOCALE);
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      defaultLocale,
      locales: locales.includes(defaultLocale) ? locales : [defaultLocale, ...locales],
      isDefault: row.isDefault,
      hosts: row.domains.map((domain) => domain.host.toLowerCase()),
    };
  });
}

const DEV_ALIAS = ".localhost";
const LOCAL_HOSTNAME = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;

/** `Shop.Example:8080` -> `{ hostname: "shop.example", port: "8080" }`. */
function splitHost(host: string) {
  const match = host.trim().toLowerCase().match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  return match ? { hostname: match[1], port: match[2] ?? "" } : null;
}

/** The host a request was addressed to; the reverse proxy's forwarded host wins over `Host`, then the URL's. */
export function requestHost(source: Request | Headers): string {
  const headers = source instanceof Request ? source.headers : source;
  const fromUrl = source instanceof Request ? new URL(source.url).host : "";
  return headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host") || fromUrl || "localhost";
}

/** Actual browser origin, including aliases and the development port. */
export function requestOrigin(source: Request | Headers): string {
  const headers = source instanceof Request ? source.headers : source;
  const host = requestHost(source);
  const protocol = headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    || (source instanceof Request ? new URL(source.url).protocol.slice(0, -1) : LOCAL_HOSTNAME.test(splitHost(host)?.hostname ?? "") ? "http" : "https");
  if (protocol !== "http" && protocol !== "https") throw new Error("Unsupported request protocol.");
  return new URL(`${protocol}://${host}`).origin;
}

/** Resolves the store, match kind and canonical origin for a request (or its headers). */
export async function resolveRequestStore(source: Request | Headers): Promise<RequestStore> {
  const headers = source instanceof Request ? source.headers : source;
  const host = requestHost(source);
  const parts = splitHost(host) ?? { hostname: "localhost", port: "" };
  const protocol =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (LOCAL_HOSTNAME.test(parts.hostname) ? "http" : "https");
  const stores = await listStores();

  const devKey =
    process.env.NODE_ENV === "development" && parts.hostname.endsWith(DEV_ALIAS)
      ? parts.hostname.slice(0, -DEV_ALIAS.length)
      : null;
  const devStore = devKey ? stores.find((candidate) => candidate.key === devKey) : undefined;
  if (devStore) return { store: devStore, via: "dev-alias", origin: `${protocol}://${parts.hostname}${parts.port ? `:${parts.port}` : ""}` };
  const store = stores.find((candidate) => candidate.hosts.includes(parts.hostname));
  // Aliases (www) link to the canonical domain.
  if (store) return { store, via: "domain", origin: `${protocol}://${store.hosts[0]}` };
  const fallback = stores.find((candidate) => candidate.isDefault) ?? stores[0];
  // The store_scoped_content migration always leaves at least one store.
  if (!fallback) throw new Error("No store is configured; run the store seed (pnpm db:seed:stores).");
  // Never echo an unknown public Host into links in production; local hosts and dev servers keep their own address.
  const ownAddress = process.env.NODE_ENV === "development" || LOCAL_HOSTNAME.test(parts.hostname) || !fallback.hosts[0];
  const canonical = ownAddress ? `${protocol}://${host}` : `https://${fallback.hosts[0]}`;
  return { store: fallback, via: "fallback", origin: canonical };
}

/**
 * Public origin of any store as seen from this request: its `<key>.localhost`
 * preview on a local dev server, otherwise its canonical domain. The panel
 * uses it to link to the store it is editing, whatever host it runs on.
 */
export function storeOriginFrom(store: Store, source: Request | Headers): string {
  const parts = splitHost(requestHost(source)) ?? { hostname: "localhost", port: "" };
  if (process.env.NODE_ENV === "development" && LOCAL_HOSTNAME.test(parts.hostname)) {
    return `http://${store.key}${DEV_ALIAS}${parts.port ? `:${parts.port}` : ""}`;
  }
  return store.hosts[0] ? `https://${store.hosts[0]}` : `https://${requestHost(source)}`;
}

/** Store switching must reach the selected host, never silently reuse another store's host. */
export function storePanelHref(store: Store, source: Request | Headers, panelPath: string): string | null {
  const hostname = splitHost(requestHost(source))?.hostname ?? "";
  const localPreview = process.env.NODE_ENV === "development" && LOCAL_HOSTNAME.test(hostname);
  if (!localPreview && !store.hosts.length) return null;
  return new URL(panelPath, storeOriginFrom(store, source)).href;
}

/**
 * Whether account flows (sign-in, email links, OAuth callbacks) may run on
 * this host: a store domain, or a local host during development. Rejecting
 * everything else keeps a spoofed Host header out of emailed links.
 */
export function isAccountHost(match: RequestStore, source: Request | Headers): boolean {
  if (match.via !== "fallback") return true;
  const hostname = splitHost(requestHost(source))?.hostname ?? "";
  return process.env.NODE_ENV === "development" && LOCAL_HOSTNAME.test(hostname);
}

/** Production origins of every store domain, for auth's trusted origins. */
export async function allStoreOrigins(): Promise<string[]> {
  return (await listStores()).flatMap((store) => store.hosts.map((host) => `https://${host}`));
}
