import { prisma } from "./prisma";
import { entitlementCovers } from "./billing-access";

export type CustomerDownloadProduct = {
  id: string;
  name: string;
  storeName: string;
  packageCount: number;
  files: { id: string; version: string; fileName: string; createdAt: Date }[];
};

/** A shared account's downloads span stores, but always belong to this buyer and payment mode. */
export async function loadCustomerDownloads(userId: string, mode: "test" | "prod"): Promise<CustomerDownloadProduct[]> {
  const entitlements = await prisma.entitlement.findMany({
    where: { revokedAt: null, customer: { userId, mode } },
    orderBy: { createdAt: "desc" },
    select: {
      revokedAt: true,
      updatesUntil: true,
      store: { select: { name: true } },
      product: {
        select: {
          id: true,
          name: true,
          releases: {
            orderBy: { createdAt: "desc" },
            select: { id: true, version: true, fileName: true, createdAt: true },
          },
        },
      },
    },
  });

  const products = new Map<string, CustomerDownloadProduct>();
  for (const entitlement of entitlements) {
    const { product } = entitlement;
    const entry = products.get(product.id) ?? {
      id: product.id,
      name: product.name,
      storeName: entitlement.store.name,
      packageCount: product.releases.length,
      files: [],
    };
    for (const release of product.releases) {
      if (entitlementCovers(entitlement, release) && !entry.files.some((file) => file.id === release.id)) {
        entry.files.push(release);
      }
    }
    entry.files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    products.set(product.id, entry);
  }
  return [...products.values()];
}
