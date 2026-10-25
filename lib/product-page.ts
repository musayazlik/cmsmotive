import { readCompliance, type ProductCompliance } from "./product-compliance";
import { creemMode, creemConfigured } from "./creem";
import { getLegalSettings } from "./legal";
import { legalReadiness } from "./legal-settings-shared";
import { prisma } from "./prisma";
import { readChanges } from "./changelog";
import { readCompatibility, type ChangeItem, type CompatibilityRow } from "./catalog-guard";

type Image = { url: string; alt: string; width: number; height: number };

/** A price as the buy panel and checkout form show it. */
export type PublicPrice = {
  id: string;
  name: string;
  billingType: string;
  interval: string | null;
  amountCents: number;
  currency: string;
  taxMode: string;
  seats: number;
  updatesMonths: number | null;
  features: string[];
};

export type ProductTypeRef = { key: string; name: string; pluralName: string; listPath: string };

/** Everything a product detail page (/products/<slug>) shows, all edited under /panel. */
export type ProductPageData = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  tagline: string | null;
  intro: string | null;
  category: string | null;
  technologies: string[];
  listPrice: number | null;
  type: ProductTypeRef;
  /** Prices that open a Creem checkout in the current payment mode. */
  prices: PublicPrice[];
  /** Every price of the store, shown as indicative when none can be bought yet. */
  indicativePrices: PublicPrice[];
  checkout: { mode: "test" | "prod"; ready: boolean; termsVersion: string };
  compliance: ProductCompliance;
  highlights: string[];
  compatibility: CompatibilityRow[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
  cover: Image | null;
  gallery: Image[];
  /** Newest release first. */
  changelog: { id: string; version: string; title: string; releasedAt: Date; changes: ChangeItem[] }[];
};

const assetSelect = { select: { url: true, alt: true, fileName: true, width: true, height: true } } as const;

export const priceSelect = {
  id: true, name: true, billingType: true, interval: true, amountCents: true, currency: true, taxMode: true,
  seats: true, updatesMonths: true, features: true, enabled: true, creemTestProductId: true, creemLiveProductId: true,
} as const;

function toImage(asset: { url: string; alt: string | null; fileName: string; width: number | null; height: number | null }): Image {
  return {
    url: asset.url,
    alt: asset.alt ?? asset.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
    width: asset.width ?? 1536,
    height: asset.height ?? 1024,
  };
}

/** Public listing page of a type: its own page, else the product catalogue filtered to it. */
export function typeListPath(type: { key: string; listPath: string | null }): string {
  return type.listPath || `/products?type=${encodeURIComponent(type.key)}`;
}

type PriceRow = PublicPrice & { enabled: boolean; creemTestProductId: string | null; creemLiveProductId: string | null };

/** Splits a store's prices into buyable (enabled, with a Creem product for this mode) and the rest. */
export function splitPrices(rows: PriceRow[]): { prices: PublicPrice[]; indicativePrices: PublicPrice[] } {
  const mode = creemMode();
  const strip = ({ enabled: _enabled, creemTestProductId: _test, creemLiveProductId: _live, ...price }: PriceRow): PublicPrice => price;
  const buyable = rows.filter((row) => row.enabled && (mode === "prod" ? row.creemLiveProductId : row.creemTestProductId));
  return { prices: buyable.map(strip), indicativePrices: rows.map(strip) };
}

/** The product of `slug` as listed in a store, with that store's prices and checkout readiness. */
export async function loadProductPage(storeId: string, slug: string): Promise<ProductPageData | null> {
  const product = await prisma.product.findFirst({
    where: { slug, listings: { some: { storeId } } },
    include: {
      type: true,
      cover: assetSelect,
      gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
      changelog: {
        orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, version: true, title: true, releasedAt: true, changes: true },
      },
      prices: { where: { storeId }, orderBy: [{ position: "asc" }, { amountCents: "asc" }], select: priceSelect },
    },
  });
  if (!product) return null;

  const legal = await getLegalSettings(storeId);
  const mode = creemMode();
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    status: product.status,
    tagline: product.tagline,
    intro: product.intro,
    category: product.category,
    technologies: product.technologies,
    listPrice: product.listPrice,
    type: { key: product.type.key, name: product.type.name, pluralName: product.type.pluralName, listPath: typeListPath(product.type) },
    ...splitPrices(product.prices),
    checkout: {
      mode,
      ready: creemConfigured() && (mode === "test" || (!legalReadiness(legal).length && legal.salesTermsReviewed)),
      termsVersion: legal.termsVersion,
    },
    compliance: readCompliance(product.compliance),
    highlights: product.highlights,
    compatibility: readCompatibility(product.compatibility),
    ctaLabel: product.ctaLabel,
    ctaUrl: product.ctaUrl,
    demoUrl: product.demoUrl,
    cover: product.cover ? toImage(product.cover) : null,
    gallery: product.gallery.map((entry) => toImage(entry.asset)),
    changelog: product.changelog.map((entry) => ({ ...entry, changes: readChanges(entry.changes) })),
  };
}
