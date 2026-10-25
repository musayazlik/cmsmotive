import type { Prisma } from "@/generated/prisma/client";
import { readCompatibility, type CompatibilityRow } from "@/lib/catalog-guard";
import {
  deletePrice,
  deleteProduct,
  findStoreProduct,
  savePrice,
  saveProduct,
  type AdminResult,
} from "@/lib/product-admin";
import { readCompliance, type ProductCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { mcpStoreId } from "@/mcp/context";
import { ToolError } from "./result";

/**
 * Product catalogue operations for the MCP tools, built on lib/product-admin
 * so the panel API and the tools validate and authorize identically: a store
 * sees every product it owns or lists, listed products may be edited, but
 * deletion and the media library stay with the owner. Creation validates the
 * full payload; updates accept partial fields and merge them with the stored
 * record, so an agent can change a single field without re-sending the whole
 * product.
 */

export type ProductInput = {
  name?: string;
  slug?: string;
  summary?: string;
  description?: string;
  status?: string;
  typeId?: string;
  typeKey?: string;
  category?: string;
  technologies?: string[];
  listPrice?: number | null;
  position?: number;
  compliance?: Partial<ProductCompliance>;
  storeIds?: string[];
  tagline?: string;
  intro?: string;
  highlights?: string[];
  compatibility?: CompatibilityRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  demoUrl?: string;
  coverId?: string | null;
  galleryIds?: string[];
};

export type ProductCreateInput = ProductInput & {
  name: string;
  summary: string;
  description: string;
};

/** Turns an AdminResult into a tool result, keeping the API's error messages. */
async function admin<T>(result: AdminResult<T> | Promise<AdminResult<T>>): Promise<T> {
  const settled = await result;
  if ("error" in settled) throw new ToolError(settled.error);
  return settled.data;
}

/** Resolves a type by id or key; agents usually know the stable key ("theme"). */
async function resolveTypeId(input: { typeId?: string; typeKey?: string }): Promise<string | undefined> {
  if (input.typeId) return input.typeId;
  if (!input.typeKey) return undefined;
  const type = await prisma.productType.findUnique({ where: { key: input.typeKey }, select: { id: true } });
  if (!type) throw new ToolError("No product type uses this key. List the types first.");
  return type.id;
}

/** Changelog entries and reviews are visible through their product: owned or listed. */
export function changelogInStore(storeId: string): Prisma.ChangelogEntryWhereInput {
  return { product: { OR: [{ storeId }, { listings: { some: { storeId } } }] } };
}

/* ---------------------------------------------------------------- products */

export async function createProduct(input: ProductCreateInput) {
  const typeId = await resolveTypeId(input);
  if (!typeId) throw new ToolError("Choose the product type (typeId or typeKey).");

  const body: Record<string, unknown> = {
    ...input,
    typeId,
    slug: slugify(input.slug?.trim() || input.name),
    status: input.status ?? "concept",
    category: input.category ?? "",
    technologies: input.technologies ?? [],
    listPrice: input.listPrice ?? null,
    position: input.position ?? 0,
    tagline: input.tagline ?? "",
    intro: input.intro ?? "",
    highlights: input.highlights ?? [],
    compatibility: input.compatibility ?? [],
    ctaLabel: input.ctaLabel ?? "",
    ctaUrl: input.ctaUrl ?? "",
    demoUrl: input.demoUrl ?? "",
    coverId: input.coverId ?? null,
    galleryIds: input.galleryIds ?? [],
  };
  return admin(saveProduct(mcpStoreId(), null, body));
}

export async function updateProduct(id: string, input: ProductInput) {
  const storeId = mcpStoreId();
  const current = await prisma.product.findFirst({
    where: { id, OR: [{ storeId }, { listings: { some: { storeId } } }] },
    include: {
      gallery: { orderBy: { position: "asc" }, select: { assetId: true } },
      listings: { select: { storeId: true, position: true } },
    },
  });
  if (!current) throw new ToolError("Product not found.");

  const body: Record<string, unknown> = {
    name: input.name ?? current.name,
    slug: input.slug !== undefined ? (input.slug.trim() ? slugify(input.slug) : current.slug) : current.slug,
    summary: input.summary ?? current.summary,
    description: input.description ?? current.description,
    status: input.status ?? current.status,
    typeId: (await resolveTypeId(input)) ?? current.typeId,
    category: input.category !== undefined ? input.category : (current.category ?? ""),
    technologies: input.technologies ?? current.technologies,
    listPrice: input.listPrice !== undefined ? input.listPrice : current.listPrice,
    // The session store's listing position; saveProduct keeps that row in sync.
    position: input.position ?? (current.listings.find((listing) => listing.storeId === storeId)?.position ?? 0),
    tagline: input.tagline !== undefined ? input.tagline : (current.tagline ?? ""),
    intro: input.intro !== undefined ? input.intro : (current.intro ?? ""),
    highlights: input.highlights ?? current.highlights,
    compatibility: input.compatibility ?? readCompatibility(current.compatibility),
    compliance: { ...readCompliance(current.compliance), ...(input.compliance ?? {}) },
    ctaLabel: input.ctaLabel !== undefined ? input.ctaLabel : (current.ctaLabel ?? ""),
    ctaUrl: input.ctaUrl !== undefined ? input.ctaUrl : (current.ctaUrl ?? ""),
    demoUrl: input.demoUrl !== undefined ? input.demoUrl : (current.demoUrl ?? ""),
    coverId: input.coverId !== undefined ? input.coverId : current.coverId,
    galleryIds: input.galleryIds ?? current.gallery.map((entry) => entry.assetId),
    storeIds: input.storeIds,
  };

  return admin(saveProduct(storeId, id, body));
}

/** Deletes a product; only the owning store may (deleteProduct enforces it). */
export async function deleteProductRecord(id: string): Promise<{ id: string; deleted: true }> {
  await admin(deleteProduct(mcpStoreId(), id));
  return { id, deleted: true };
}

/* ------------------------------------------------------------ product types */

export async function listProductTypes() {
  const types = await prisma.productType.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, pluralName: true, description: true, listPath: true },
  });
  return { types, total: types.length };
}

/* -------------------------------------------------------------- list / get */

export type ProductListInput = {
  q?: string;
  status?: string[];
  typeKey?: string;
  page: number;
  pageSize: number;
  orderBy: "position" | "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
};

export async function listProducts(input: ProductListInput) {
  const storeId = mcpStoreId();
  const productWhere: Prisma.ProductWhereInput = {
    // Listing through ProductStore orders by the store's own sort position,
    // exactly like the panel's product list.
    listings: { some: { storeId } },
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { slug: { contains: input.q, mode: "insensitive" } },
            { summary: { contains: input.q, mode: "insensitive" } },
            { category: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.status && input.status.length > 0 ? { status: { in: input.status } } : {}),
    ...(input.typeKey ? { type: { key: input.typeKey } } : {}),
  };

  const orderBy: Prisma.ProductStoreOrderByWithRelationInput[] =
    input.orderBy === "position"
      ? [{ position: input.order }, { createdAt: "asc" }]
      : [
          {
            product:
              input.orderBy === "name"
                ? { name: input.order }
                : input.orderBy === "updatedAt"
                  ? { updatedAt: input.order }
                  : { createdAt: input.order },
          },
          { position: "asc" },
        ];

  const [total, rows] = await Promise.all([
    prisma.productStore.count({ where: { storeId, product: productWhere } }),
    prisma.productStore.findMany({
      where: { storeId, product: productWhere },
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        position: true,
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            status: true,
            category: true,
            technologies: true,
            listPrice: true,
            storeId: true,
            type: { select: { id: true, key: true, name: true, pluralName: true } },
            cover: { select: { id: true, url: true, fileName: true } },
            prices: { where: { storeId }, select: { enabled: true } },
            _count: { select: { releases: true, changelog: true, reviews: true } },
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  return {
    products: rows.map(({ position, product: { prices, _count, ...product } }) => ({
      ...product,
      position,
      ownedHere: product.storeId === storeId,
      prices: prices.length,
      enabledPrices: prices.filter((price) => price.enabled).length,
      counts: { releases: _count.releases, changelog: _count.changelog, reviews: _count.reviews },
      updatedAt: product.updatedAt.toISOString(),
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

export async function getProduct(args: { id?: string; slug?: string }) {
  if (!args.id && !args.slug) throw new ToolError("Provide either id or slug.");
  const storeId = mcpStoreId();
  const product = await prisma.product.findFirst({
    where: {
      ...(args.id ? { id: args.id } : { slug: args.slug }),
      OR: [{ storeId }, { listings: { some: { storeId } } }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
      status: true,
      category: true,
      technologies: true,
      listPrice: true,
      storeId: true,
      type: { select: { id: true, key: true, name: true, pluralName: true } },
      tagline: true,
      intro: true,
      highlights: true,
      compatibility: true,
      compliance: true,
      ctaLabel: true,
      ctaUrl: true,
      demoUrl: true,
      cover: { select: { id: true, url: true, fileName: true, alt: true } },
      gallery: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          asset: { select: { id: true, url: true, fileName: true, alt: true } },
        },
      },
      listings: { select: { storeId: true, position: true } },
      prices: {
        where: { storeId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, billingType: true, amountCents: true, currency: true, enabled: true },
      },
      releases: {
        orderBy: { createdAt: "desc" },
        select: { id: true, version: true, fileName: true, codeLicense: true, createdAt: true },
      },
      _count: { select: { changelog: true, reviews: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!product) throw new ToolError("Product not found.");

  const pendingReviews = await prisma.productReview.count({
    where: { storeId, productId: product.id, status: "pending" },
  });

  return {
    ...product,
    ownedHere: product.storeId === storeId,
    position: product.listings.find((listing) => listing.storeId === storeId)?.position ?? 0,
    listings: undefined,
    compatibility: readCompatibility(product.compatibility),
    compliance: readCompliance(product.compliance),
    cover: product.cover
      ? { assetId: product.cover.id, url: product.cover.url, fileName: product.cover.fileName, alt: product.cover.alt }
      : null,
    gallery: product.gallery.map((entry) => ({
      assetId: entry.asset.id,
      url: entry.asset.url,
      fileName: entry.asset.fileName,
      alt: entry.asset.alt,
      position: entry.position,
    })),
    releases: product.releases.map((release) => ({ ...release, createdAt: release.createdAt.toISOString() })),
    counts: {
      changelog: product._count.changelog,
      reviews: product._count.reviews,
      pendingReviews,
    },
    _count: undefined,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ prices */

export async function listPrices(productId: string) {
  if (!(await findStoreProduct(mcpStoreId(), productId))) throw new ToolError("Product not found.");
  const prices = await prisma.price.findMany({
    where: { productId, storeId: mcpStoreId() },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      billingType: true,
      interval: true,
      amountCents: true,
      currency: true,
      taxMode: true,
      updatesMonths: true,
      seats: true,
      features: true,
      creemTestProductId: true,
      creemLiveProductId: true,
      enabled: true,
      position: true,
    },
  });
  return { prices, total: prices.length };
}

export async function savePriceRecord(productId: string, priceId: string | null, input: Record<string, unknown>) {
  return admin(savePrice(mcpStoreId(), productId, priceId, input));
}

export async function deletePriceRecord(priceId: string): Promise<{ id: string; deleted: true }> {
  await admin(deletePrice(mcpStoreId(), priceId));
  return { id: priceId, deleted: true };
}
