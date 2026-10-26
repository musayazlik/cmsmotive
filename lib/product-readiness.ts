import { creemMode } from "./creem";
import { getLegalSettings } from "./legal";
import { legalReadiness, reservedNameTerms, reservedTermIn } from "./legal-settings-shared";
import { codeLicenseProblem } from "./code-license";
import { readAudit } from "./package-audit";
import { publicationMissingLabels, readCompliance } from "./product-compliance";
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
      releases: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { version: true, audit: true } },
      prices: { where: { enabled: true }, select: { id: true } },
    },
  });
  if (!product) return null;
  const mode = creemMode();
  const legal = await getLegalSettings(product.storeId);
  const legalMissing = [...legalReadiness(legal), ...(legal.salesTermsReviewed ? [] : ["sales terms review"])];
  const packageMissing = publicationMissingLabels(readCompliance(product.compliance));
  const text = product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Trademarks the store reserves (Settings → Legal), e.g. a platform name a product may only claim compatibility with.
  const terms = reservedNameTerms(legal);
  const reserved = reservedTermIn(product.name, terms);
  const latest = product.releases[0];
  const audit = latest ? readAudit(latest.audit) : null;
  const licenseProblem = codeLicenseProblem(readCompliance(product.compliance).codeLicense, true);

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
    ...(latest
      ? [
          {
            key: "audit",
            label: "Latest package passes the licence check",
            ok: Boolean(audit && audit.errors.length === 0),
            hint: !audit
              ? `Run the licence check on version ${latest.version} (Packages tab).`
              : audit.errors.length
                ? audit.errors.map((issue) => issue.message).join(" ")
                : "Licence file, readable source and notices are in place.",
            tab: "packages" as const,
          },
        ]
      : []),
    ...(legal.gplCodeRequired
      ? [
          {
            key: "gpl",
            label: "GPL code license",
            ok: !licenseProblem,
            hint: licenseProblem ?? "The code is distributed under the GNU GPL.",
            tab: "packages" as const,
          },
        ]
      : []),
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
