import { prisma } from "./prisma";
import {
  entitlementCovers,
  entitlementReceivesUpdates,
} from "./billing-access";
import { readChanges } from "./changelog";

/** Only buyer-owned data and download identifiers leave this loader; storage keys remain private. */
export async function loadCustomerLibrary(
  userId: string,
  mode: "test" | "prod",
) {
  const entitlements = await prisma.entitlement.findMany({
    where: { customer: { userId, mode } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      seats: true,
      createdAt: true,
      updatesUntil: true,
      revokedAt: true,
      store: { select: { name: true } },
      order: { select: { price: { select: { name: true, features: true } } } },
      subscription: {
        select: {
          status: true,
          price: { select: { name: true, features: true } },
        },
      },
      licenseKeys: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          key: true,
          status: true,
          creemLicenseId: true,
          activations: true,
          activationLimit: true,
          expiresAt: true,
        },
      },
      product: {
        select: {
          name: true,
          summary: true,
          highlights: true,
          technologies: true,
          deliveryNote: true,
          type: { select: { name: true } },
          releases: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              version: true,
              fileName: true,
              codeLicense: true,
              createdAt: true,
            },
          },
          changelog: {
            orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
            take: 5,
            select: {
              id: true,
              version: true,
              title: true,
              releasedAt: true,
              changes: true,
            },
          },
        },
      },
    },
  });
  return entitlements.map((entitlement) => {
    const { product } = entitlement;
    const plan = entitlement.subscription?.price ?? entitlement.order?.price;
    return {
      id: entitlement.id,
      name: product.name,
      type: product.type.name,
      store: entitlement.store.name,
      summary: product.summary,
      plan: plan?.name ?? "",
      seats: entitlement.seats,
      features: plan?.features.length ? plan.features : product.highlights,
      technologies: product.technologies,
      deliveryNote: product.deliveryNote,
      purchasedAt: entitlement.createdAt.toISOString(),
      updatesUntil: entitlement.updatesUntil?.toISOString() ?? null,
      updatesActive: entitlementReceivesUpdates(entitlement),
      revoked: Boolean(entitlement.revokedAt),
      subscriptionStatus: entitlement.subscription?.status ?? null,
      releases: product.releases.map((release) => ({
        id: release.id,
        version: release.version,
        fileName: release.fileName,
        license: release.codeLicense,
        createdAt: release.createdAt.toISOString(),
        available: entitlementCovers(entitlement, release),
      })),
      licenses: entitlement.revokedAt
        ? []
        : entitlement.licenseKeys.map((license) => ({
            id: license.id,
            key: license.key,
            status: license.status,
            activations: license.creemLicenseId ? license.activations : null,
            limit: license.activationLimit,
            expiresAt: license.expiresAt?.toISOString() ?? null,
          })),
      changelog: product.changelog.map((entry) => ({
        id: entry.id,
        version: entry.version,
        title: entry.title,
        releasedAt: entry.releasedAt.toISOString(),
        changes: readChanges(entry.changes),
      })),
    };
  });
}

export type CustomerLibraryItem = Awaited<
  ReturnType<typeof loadCustomerLibrary>
>[number];
