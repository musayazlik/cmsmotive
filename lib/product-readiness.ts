import { creemMode } from "./creem";
import { getLegalSettings } from "./legal";
import { legalReadiness, reservedNameTerms, reservedTermIn } from "./legal-settings-shared";
import { publicationMissing, readCompliance } from "./product-compliance";
import { prisma } from "./prisma";

/** Where in the panel a missing item is fixed. */
export type ReadinessTab = "general" | "prices" | "packages" | "legal";

export type ReadinessItem = { key: string; label: string; ok: boolean; hint: string; tab: ReadinessTab };

export type Readiness = { items: ReadinessItem[]; ready: boolean; mode: "test" | "prod" };

/**
 * The single answer to "can this product be published?", shown as a
 * checklist on the Publish tab and enforced when the status changes. Every
 * item says where it is fixed, so nothing is learned from failed saves.
 */
export async function productReadiness(productId: string): Promise<Readiness | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      storeId: true, name: true, description: true, coverId: true, compliance: true,
      _count: { select: { releases: true } },
      prices: { where: { enabled: true }, select: { id: true } },
    },
  });
  if (!product) return null;
  const mode = creemMode();
  const legal = await getLegalSettings(product.storeId);
  const legalMissing = [...legalReadiness(legal), ...(legal.salesTermsReviewed ? [] : ["sales terms review"])];
  const packageMissing = publicationMissing(readCompliance(product.compliance));
  const text = product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Trademarks the store reserves (Settings → Legal), e.g. a platform name a product may only claim compatibility with.
  const terms = reservedNameTerms(legal);
  const reserved = reservedTermIn(product.name, terms);

  const items: ReadinessItem[] = [
    { key: "description", label: "Description", ok: text.length >= 10, hint: "Write what the product does and who it is for.", tab: "general" },
    { key: "cover", label: "Cover image", ok: Boolean(product.coverId), hint: "Add a cover; the catalogue card and the detail page use it.", tab: "general" },
    ...(terms.length
      ? [
          {
            key: "name",
            label: "Own product name",
            ok: !reserved,
            hint: `Product names may not contain the trademark “${reserved ?? terms[0]}”; describe compatibility separately.`,
            tab: "general" as const,
          },
        ]
      : []),
    { key: "price", label: "A price on sale", ok: product.prices.length > 0, hint: "Add a price and put it on sale; its Creem product is created for you.", tab: "prices" },
    { key: "package", label: "Package uploaded", ok: product._count.releases > 0, hint: "Upload the ZIP customers download after paying.", tab: "packages" },
    {
      key: "checklist",
      label: "Package checklist",
      ok: packageMissing.length === 0,
      hint: packageMissing.length ? `Complete: ${packageMissing.join(", ")}.` : "Licence, notices, version, tested versions and support scope.",
      tab: "packages",
    },
    {
      key: "legal",
      label: "Legal information",
      ok: legalMissing.length === 0,
      hint: legalMissing.length ? `Settings → Legal: ${legalMissing.join(", ")}.` : "Seller identity and reviewed sales terms.",
      tab: "legal",
    },
  ];
  return { items, ready: items.every((item) => item.ok), mode };
}
