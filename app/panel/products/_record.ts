import { readCompatibility, type CompatibilityRow } from "@/lib/catalog-guard";
import { readCompliance, type ProductCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { listStores } from "@/lib/stores";
import type { UploadedImage } from "../_components/catalog-media";

/** A product of the edited store, as its edit page loads it. */
export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  badge: string;
  typeId: string;
  category: string;
  technologies: string[];
  position: number;
  tagline: string;
  intro: string;
  highlights: string[];
  compatibility: CompatibilityRow[];
  compliance: ProductCompliance;
  ctaLabel: string;
  ctaUrl: string;
  demoUrl: string;
  cover: UploadedImage | null;
  gallery: UploadedImage[];
  counts: { prices: number; pricesOnSale: number; releases: number; changelog: number; reviews: number; pendingReviews: number; orders: number };
  createdAt: string;
  updatedAt: string;
};

export type ProductTypeOption = { id: string; key: string; name: string };
export type StoreOption = { id: string; name: string };

const assetSelect = { select: { id: true, url: true, fileName: true } } as const;
const toImage = (asset: { id: string; url: string; fileName: string }): UploadedImage => ({ assetId: asset.id, url: asset.url, name: asset.fileName });

/** The product if it belongs to the store. */
export async function loadProduct(storeId: string, id: string): Promise<ProductRecord | null> {
  const product = await prisma.product.findFirst({
    where: { id, storeId },
    include: {
      cover: assetSelect,
      gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
      prices: { select: { enabled: true } },
      _count: { select: { releases: true, changelog: true, reviews: true, orders: true } },
    },
  });
  if (!product) return null;
  const pendingReviews = await prisma.productReview.count({ where: { productId: id, status: "pending" } });
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    status: product.status,
    badge: product.badge ?? "",
    typeId: product.typeId,
    category: product.category ?? "",
    technologies: product.technologies,
    position: product.position,
    tagline: product.tagline ?? "",
    intro: product.intro ?? "",
    highlights: product.highlights,
    compatibility: readCompatibility(product.compatibility),
    compliance: readCompliance(product.compliance),
    ctaLabel: product.ctaLabel ?? "",
    ctaUrl: product.ctaUrl ?? "",
    demoUrl: product.demoUrl ?? "",
    cover: product.cover ? toImage(product.cover) : null,
    gallery: product.gallery.map((entry) => toImage(entry.asset)),
    counts: {
      prices: product.prices.length,
      pricesOnSale: product.prices.filter((price) => price.enabled).length,
      releases: product._count.releases,
      changelog: product._count.changelog,
      reviews: product._count.reviews,
      pendingReviews,
      orders: product._count.orders,
    },
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** Product types for the type pickers (shared by every store). */
export function productTypeOptions(): Promise<ProductTypeOption[]> {
  return prisma.productType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, key: true, name: true } });
}

/** The other stores a product can be copied to. */
export async function otherStores(storeId: string): Promise<StoreOption[]> {
  return (await listStores()).filter((store) => store.id !== storeId).map(({ id, name }) => ({ id, name }));
}
