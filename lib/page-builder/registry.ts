import { prisma } from "@/lib/prisma";

/**
 * The published page list the proxy consults (plan 5.8). On every request
 * proxy.ts needs to know which slugs are live and which old slugs redirect;
 * hitting the database per request would tax every public URL, so the list
 * is cached in process with the same short TTL pattern lib/stores.ts uses.
 * Publishing and unpublishing invalidate the store's entry immediately —
 * multi-instance deployments accept up to one TTL of staleness.
 */

export type PublishedPageEntry = { slug: string; kind: string; locales: string[] };
export type PublishedRedirectEntry = { fromSlug: string; toSlug: string };

export type StorePageRegistry = {
  pages: PublishedPageEntry[];
  redirects: PublishedRedirectEntry[];
};

const REGISTRY_TTL = 30_000;
const cache = new Map<string, { at: number; data: Promise<StorePageRegistry> }>();

export function getStorePageRegistry(storeId: string): Promise<StorePageRegistry> {
  const cached = cache.get(storeId);
  if (cached && Date.now() - cached.at <= REGISTRY_TTL) return cached.data;
  const data = loadStorePageRegistry(storeId);
  cache.set(storeId, { at: Date.now(), data });
  // A failed query must not serve errors for the whole TTL.
  data.catch(() => {
    const current = cache.get(storeId);
    if (current?.data === data) cache.delete(storeId);
  });
  return data;
}

/** Publish, unpublish, create and delete all change what the proxy shows. */
export function invalidatePageRegistry(storeId?: string): void {
  if (storeId) cache.delete(storeId);
  else cache.clear();
}

async function loadStorePageRegistry(storeId: string): Promise<StorePageRegistry> {
  const [pages, redirects] = await Promise.all([
    prisma.page.findMany({
      where: { storeId, locales: { some: { status: "published" } } },
      select: {
        slug: true,
        kind: true,
        locales: { where: { status: "published" }, select: { locale: true } },
      },
    }),
    prisma.pageRedirect.findMany({
      where: {
        storeId,
        page: { locales: { some: { status: "published" } } },
      },
      select: { fromSlug: true, page: { select: { slug: true } } },
    }),
  ]);
  return {
    pages: pages.map((page) => ({
      slug: page.slug,
      kind: page.kind,
      locales: page.locales.map((locale) => locale.locale),
    })),
    redirects: redirects.map((redirect) => ({ fromSlug: redirect.fromSlug, toSlug: redirect.page.slug })),
  };
}
