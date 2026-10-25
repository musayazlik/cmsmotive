import { readCompatibility, type CompatibilityRow } from "@/lib/catalog-guard";
import { readCompliance, type ProductCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { listStores } from "@/lib/stores";
import type { UploadedImage } from "../_components/catalog-media";

/** A product as the edit page loads it, seen from the store the panel is editing. */
export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  typeId: string;
  category: string;
  technologies: string[];
  listPrice: number | null;
  /** Sort order in the edited store. */
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
  /** Whether the edited store owns the product (its media library, deletion). */
  ownedHere: boolean;
  storeIds: string[];
  counts: { changelog: number; reviews: number; pendingReviews: number; orders: number };
  createdAt: string;
  updatedAt: string;
};

export type ProductTypeOption = { id: string; key: string; name: string };
export type StoreOption = { id: string; name: string };

const assetSelect = { select: { id: true, url: true, fileName: true } } as const;
const toImage = (asset: { id: string; url: string; fileName: string }): UploadedImage => ({ assetId: asset.id, url: asset.url, name: asset.fileName });

/** The product if the store owns or lists it. */
export async function loadProduct(storeId: string, id: string): Promise<ProductRecord | null> {
  const product = await prisma.product.findFirst({
    where: { id, OR: [{ storeId }, { listings: { some: { storeId } } }] },
    include: {
      cover: assetSelect,
      gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
      listings: { select: { storeId: true, position: true } },
      _count: { select: { changelog: true, reviews: true, orders: true } },
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
    typeId: product.typeId,
    category: product.category ?? "",
    technologies: product.technologies,
    listPrice: product.listPrice,
    position: product.listings.find((listing) => listing.storeId === storeId)?.position ?? 0,
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
    ownedHere: product.storeId === storeId,
    storeIds: product.listings.map((listing) => listing.storeId),
    counts: { changelog: product._count.changelog, reviews: product._count.reviews, pendingReviews, orders: product._count.orders },
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** Choices for the form's type and store pickers. */
export async function productFormOptions(): Promise<{ types: ProductTypeOption[]; stores: StoreOption[] }> {
  const [types, stores] = await Promise.all([
    prisma.productType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, key: true, name: true } }),
    listStores(),
  ]);
  return { types, stores: stores.map(({ id, name }) => ({ id, name })) };
}
