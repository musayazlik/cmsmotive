import type { Prisma } from "@/generated/prisma/client";
import { readCompatibility, type CompatibilityRow } from "@/lib/catalog-guard";
import { creemMode } from "@/lib/creem";
import {
  copyProductToStore,
  createProduct as createDraft,
  deletePrice,
  deleteProduct,
  findStoreProduct,
  saveCompliance,
  savePrice,
  saveProduct,
  setProductStatus,
  type AdminResult,
} from "@/lib/product-admin";
import { readCompliance, type ProductCompliance } from "@/lib/product-compliance";
import { productReadiness } from "@/lib/product-readiness";
import { prisma } from "@/lib/prisma";
import { mcpStoreId } from "@/mcp/context";
import { ToolError } from "./result";

/**
 * Product catalogue operations for the MCP tools, built on lib/product-admin
 * so the panel and the tools follow the same steps: a product belongs to the
 * session's store, is created as a draft, filled in, priced and published
 * once its ready-to-sell checklist is complete. Updates accept partial fields
 * and merge them with the stored record.
 */

export type ProductInput = {
  name?: string;
  slug?: string;
  summary?: string;
  description?: string;
  typeId?: string;
  typeKey?: string;
  category?: string;
  technologies?: string[];
  badge?: string;
  position?: number;
  tagline?: string;
  intro?: string;
  highlights?: string[];
  compatibility?: CompatibilityRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  demoUrl?: string;
  coverId?: string | null;
  galleryIds?: string[];
  compliance?: Partial<ProductCompliance>;
  status?: string;
};

export type ProductCreateInput = ProductInput & { name: string; summary: string };

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

/** Changelog entries and reviews are visible through their product's store. */
export function changelogInStore(storeId: string): Prisma.ChangelogEntryWhereInput {
  return { product: { storeId } };
}

/* ---------------------------------------------------------------- products */

/** Creates a draft (type, name, summary), then applies any other given fields like products_update. */
export async function createProduct(input: ProductCreateInput) {
  const typeId = await resolveTypeId(input);
  if (!typeId) throw new ToolError("Choose the product type (typeId or typeKey).");
  const draft = await admin(createDraft(mcpStoreId(), { typeId, name: input.name, summary: input.summary }));
  const { name: _name, summary: _summary, typeId: _typeId, typeKey: _typeKey, ...rest } = input;
  return Object.keys(rest).length ? updateProduct(draft.id, rest) : draft;
}

/**
 * Partial update: content fields go through the General save, `compliance`
 * through the package checklist, `status` last (publishing runs the
 * ready-to-sell check).
 */
export async function updateProduct(id: string, input: ProductInput) {
  const storeId = mcpStoreId();
  const current = await prisma.product.findFirst({
    where: { id, storeId },
    include: { gallery: { orderBy: { position: "asc" }, select: { assetId: true } } },
  });
  if (!current) throw new ToolError("Product not found.");
  const { compliance, status, ...content } = input;

  if (Object.keys(content).length) {
    await admin(
      saveProduct(storeId, id, {
        name: content.name ?? current.name,
        slug: content.slug?.trim() || current.slug,
        summary: content.summary ?? current.summary,
        description: content.description ?? current.description,
        typeId: (await resolveTypeId(content)) ?? current.typeId,
        category: content.category !== undefined ? content.category : (current.category ?? ""),
        technologies: content.technologies ?? current.technologies,
        badge: content.badge !== undefined ? content.badge : (current.badge ?? ""),
        position: content.position ?? current.position,
        tagline: content.tagline !== undefined ? content.tagline : (current.tagline ?? ""),
        intro: content.intro !== undefined ? content.intro : (current.intro ?? ""),
        highlights: content.highlights ?? current.highlights,
        compatibility: content.compatibility ?? readCompatibility(current.compatibility),
        ctaLabel: content.ctaLabel !== undefined ? content.ctaLabel : (current.ctaLabel ?? ""),
        ctaUrl: content.ctaUrl !== undefined ? content.ctaUrl : (current.ctaUrl ?? ""),
        demoUrl: content.demoUrl !== undefined ? content.demoUrl : (current.demoUrl ?? ""),
        coverId: content.coverId !== undefined ? content.coverId : current.coverId,
        galleryIds: content.galleryIds ?? current.gallery.map((entry) => entry.assetId),
      }),
    );
  }
  if (compliance) {
    await admin(saveCompliance(storeId, id, { compliance: { ...readCompliance(current.compliance), ...compliance } }));
  }
  if (status !== undefined && status !== current.status) await admin(setProductStatus(storeId, id, status));
  return { id, slug: content.slug?.trim() || current.slug };
}

export async function deleteProductRecord(id: string): Promise<{ id: string; deleted: true }> {
  await admin(deleteProduct(mcpStoreId(), id));
  return { id, deleted: true };
}

/** Copies a product into another store (by store key) as a draft. */
export async function copyProduct(id: string, storeKey: string) {
  const target = await prisma.store.findUnique({ where: { key: storeKey }, select: { id: true } });
  if (!target) throw new ToolError("No store has this key.");
  return admin(copyProductToStore(mcpStoreId(), id, target.id));
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
  const where: Prisma.ProductWhereInput = {
    storeId,
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
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ [input.orderBy]: input.order }, { createdAt: "asc" }];

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true, slug: true, name: true, summary: true, status: true, badge: true, category: true, technologies: true, position: true,
        type: { select: { id: true, key: true, name: true, pluralName: true } },
        cover: { select: { id: true, url: true, fileName: true } },
        prices: { select: { enabled: true } },
        _count: { select: { releases: true, changelog: true, reviews: true } },
        updatedAt: true,
      },
    }),
  ]);

  return {
    products: rows.map(({ prices, _count, ...product }) => ({
      ...product,
      prices: prices.length,
      pricesOnSale: prices.filter((price) => price.enabled).length,
      counts: { releases: _count.releases, changelog: _count.changelog, reviews: _count.reviews },
      updatedAt: product.updatedAt.toISOString(),
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

/** One product with its prices, releases and ready-to-sell checklist. */
export async function getProduct(args: { id?: string; slug?: string }) {
  if (!args.id && !args.slug) throw new ToolError("Provide either id or slug.");
  const storeId = mcpStoreId();
  const product = await prisma.product.findFirst({
    where: { storeId, ...(args.id ? { id: args.id } : { slug: args.slug }) },
    include: {
      type: { select: { id: true, key: true, name: true, pluralName: true } },
      cover: { select: { id: true, url: true, fileName: true, alt: true } },
      gallery: { orderBy: { position: "asc" }, select: { position: true, asset: { select: { id: true, url: true, fileName: true, alt: true } } } },
      prices: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, billingType: true, interval: true, amountCents: true, currency: true, enabled: true },
      },
      releases: { orderBy: { createdAt: "desc" }, select: { id: true, version: true, fileName: true, codeLicense: true, createdAt: true } },
      _count: { select: { changelog: true, reviews: true } },
    },
  });
  if (!product) throw new ToolError("Product not found.");
  const [pendingReviews, readiness] = await Promise.all([
    prisma.productReview.count({ where: { productId: product.id, status: "pending" } }),
    productReadiness(product.id),
  ]);
  const { _count, coverId: _coverId, typeId: _typeId, storeId: _storeId, ...rest } = product;

  return {
    ...rest,
    compatibility: readCompatibility(product.compatibility),
    compliance: readCompliance(product.compliance),
    cover: product.cover ? { assetId: product.cover.id, url: product.cover.url, fileName: product.cover.fileName, alt: product.cover.alt } : null,
    gallery: product.gallery.map((entry) => ({ assetId: entry.asset.id, url: entry.asset.url, fileName: entry.asset.fileName, alt: entry.asset.alt, position: entry.position })),
    releases: product.releases.map((release) => ({ ...release, createdAt: release.createdAt.toISOString() })),
    readyToSell: readiness ? { ready: readiness.ready, missing: readiness.items.filter((item) => !item.ok).map((item) => `${item.label}: ${item.hint}`) } : null,
    counts: { changelog: _count.changelog, reviews: _count.reviews, pendingReviews },
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ prices */

const priceSelect = {
  id: true, name: true, billingType: true, interval: true, amountCents: true, currency: true, taxMode: true,
  updatesMonths: true, seats: true, features: true, creemTestProductId: true, creemLiveProductId: true, enabled: true, position: true,
} as const;

export async function listPrices(productId: string) {
  if (!(await findStoreProduct(mcpStoreId(), productId))) throw new ToolError("Product not found.");
  const field = creemMode() === "prod" ? "creemLiveProductId" : "creemTestProductId";
  const prices = await prisma.price.findMany({ where: { productId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: priceSelect });
  return {
    prices: prices.map(({ creemTestProductId: _test, creemLiveProductId: _live, ...price }) => ({ ...price, creemProductId: (field === "creemLiveProductId" ? _live : _test) ?? null })),
    total: prices.length,
  };
}

/** Creates a price, or updates one with only the given fields (merged with the stored price). */
export async function savePriceRecord(productId: string, priceId: string | null, input: Record<string, unknown>) {
  let body = input;
  if (priceId) {
    const current = await prisma.price.findFirst({ where: { id: priceId, productId }, select: priceSelect });
    if (!current) throw new ToolError("Price not found.");
    const { creemTestProductId: _test, creemLiveProductId: _live, id: _id, ...stored } = current;
    body = { ...stored, ...input };
  }
  return admin(savePrice(mcpStoreId(), productId, priceId, body));
}

export async function deletePriceRecord(priceId: string): Promise<{ id: string; deleted: true }> {
  await admin(deletePrice(mcpStoreId(), priceId));
  return { id: priceId, deleted: true };
}
