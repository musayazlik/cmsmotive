import { Prisma } from "@/generated/prisma/client";
import { validateDetail, validateProduct, validateProductType } from "@/lib/catalog-guard";
import { creemMode, creemRequest } from "@/lib/creem";
import { creemProductMismatch, validatePrice } from "@/lib/prices";
import { validateCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { publicationError } from "@/lib/publication";

/**
 * Writes for products, prices and product types, shared by the panel's admin
 * API and the MCP tools. Every function validates the whole payload and
 * returns either the saved record or a message for the user; the store is the
 * one being edited (panel) or the MCP session's store.
 */

export type AdminResult<T> = { data: T } | { error: string; status?: number };

const fail = (error: string, status = 400): { error: string; status: number } => ({ error, status });

function uniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/* ------------------------------------------------------------------ products */

/** A product the store owns or lists, or null. */
export function findStoreProduct(storeId: string, id: string) {
  return prisma.product.findFirst({
    where: { id, OR: [{ storeId }, { listings: { some: { storeId } } }] },
    select: { id: true, storeId: true, slug: true },
  });
}

/**
 * Creates (id = null) or updates a product. New products are owned and listed
 * by `storeId`; `storeIds` (optional) replaces the stores it is listed in, and
 * always keeps the owner. Images must come from the owner's media library.
 */
export async function saveProduct(storeId: string, id: string | null, body: Record<string, unknown>): Promise<AdminResult<{ id: string; slug: string }>> {
  const product = validateProduct(body);
  if ("error" in product) return fail(product.error);
  const detail = validateDetail(body);
  if ("error" in detail) return fail(detail.error);
  const compliance = validateCompliance(body.compliance);
  if ("error" in compliance) return fail(compliance.error);

  const current = id ? await findStoreProduct(storeId, id) : null;
  if (id && !current) return fail("Product not found.", 404);
  const ownerId = current?.storeId ?? storeId;

  if (!(await prisma.productType.findUnique({ where: { id: product.data.typeId }, select: { id: true } }))) {
    return fail("The chosen product type no longer exists.");
  }
  const releaseError = await publicationError(ownerId, product.data.status, product.data.name, compliance.data);
  if (releaseError) return fail(releaseError);

  const assets = [product.data.coverId, ...product.data.galleryIds].filter((asset): asset is string => Boolean(asset));
  if (assets.length && (await prisma.mediaAsset.count({ where: { id: { in: assets }, storeId: ownerId } })) !== new Set(assets).size) {
    return fail("One or more selected images could not be found in this store's media library.");
  }

  const storeIds = Array.isArray(body.storeIds)
    ? [...new Set([ownerId, ...body.storeIds.filter((value): value is string => typeof value === "string")])]
    : null;
  if (storeIds && (await prisma.store.count({ where: { id: { in: storeIds } } })) !== storeIds.length) {
    return fail("One or more selected stores do not exist.");
  }

  const { position, galleryIds, ...fields } = product.data;
  const data = { ...fields, ...detail.data, compliance: compliance.data };
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const row = current
        ? await tx.product.update({ where: { id: current.id }, data, select: { id: true, slug: true } })
        : await tx.product.create({ data: { ...data, storeId: ownerId }, select: { id: true, slug: true } });
      await tx.productGallery.deleteMany({ where: { productId: row.id } });
      if (galleryIds.length) {
        await tx.productGallery.createMany({ data: galleryIds.map((assetId, index) => ({ productId: row.id, assetId, position: index })) });
      }
      // The edited store's position always follows the form; other listings keep theirs.
      await tx.productStore.upsert({
        where: { productId_storeId: { productId: row.id, storeId } },
        create: { productId: row.id, storeId, position },
        update: { position },
      });
      if (storeIds) {
        await tx.productStore.deleteMany({ where: { productId: row.id, storeId: { notIn: [...storeIds, storeId] } } });
        for (const listed of storeIds) {
          await tx.productStore.upsert({
            where: { productId_storeId: { productId: row.id, storeId: listed } },
            create: { productId: row.id, storeId: listed, position },
            update: {},
          });
        }
      }
      return row;
    });
    return { data: saved };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another product already uses this slug.", 409);
    throw error;
  }
}

/** Deletes a product unless it has sales; sold products are kept for their customers' downloads. */
export async function deleteProduct(storeId: string, id: string): Promise<AdminResult<{ id: string }>> {
  const product = await prisma.product.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!product) return fail("Product not found, or it belongs to another store.", 404);
  const sales = await prisma.order.count({ where: { productId: id } }) + (await prisma.subscription.count({ where: { productId: id } }));
  if (sales > 0) return fail("This product has orders or subscriptions. Set it back to concept or remove it from the stores instead.", 409);
  await prisma.product.delete({ where: { id } });
  return { data: { id } };
}

/* -------------------------------------------------------------------- prices */

/**
 * Creates (priceId = null) or updates a price of a product in `storeId`. An
 * enabled price must point at a Creem product for the current payment mode
 * whose amount, currency, billing type and period match exactly.
 */
export async function savePrice(
  storeId: string,
  productId: string,
  priceId: string | null,
  body: Record<string, unknown>,
): Promise<AdminResult<{ id: string }>> {
  const product = await findStoreProduct(storeId, productId);
  if (!product) return fail("Product not found.", 404);
  const parsed = validatePrice(body);
  if ("error" in parsed) return fail(parsed.error);
  const price = parsed.data;

  const current = priceId ? await prisma.price.findFirst({ where: { id: priceId, productId, storeId } }) : null;
  if (priceId && !current) return fail("Price not found.", 404);
  if (current) {
    const sold = await prisma.order.count({ where: { priceId: current.id } }) + (await prisma.subscription.count({ where: { priceId: current.id } }));
    const changesTerms =
      current.billingType !== price.billingType || current.interval !== price.interval ||
      current.amountCents !== price.amountCents || current.currency !== price.currency;
    if (sold && changesTerms) return fail("This price has been sold. Create a new price for new terms and disable this one.", 409);
  }

  if (price.enabled) {
    const remoteId = creemMode() === "prod" ? price.creemLiveProductId : price.creemTestProductId;
    if (!remoteId) return fail(`Add the Creem ${creemMode() === "prod" ? "live" : "test"} product ID before enabling this price.`);
    let remote: Record<string, unknown>;
    try {
      remote = await creemRequest(`/v1/products/${encodeURIComponent(remoteId)}`);
    } catch {
      return fail("The Creem product could not be verified.", 502);
    }
    const mismatch = creemProductMismatch(remote, price);
    if (mismatch) return fail(mismatch);
  }

  try {
    const saved = current
      ? await prisma.price.update({ where: { id: current.id }, data: price, select: { id: true } })
      : await prisma.price.create({ data: { ...price, productId, storeId }, select: { id: true } });
    return { data: saved };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another price already uses this Creem product ID.", 409);
    throw error;
  }
}

export async function deletePrice(storeId: string, priceId: string): Promise<AdminResult<{ id: string }>> {
  const price = await prisma.price.findFirst({ where: { id: priceId, storeId }, select: { id: true } });
  if (!price) return fail("Price not found.", 404);
  const sold = await prisma.order.count({ where: { priceId } }) + (await prisma.subscription.count({ where: { priceId } }));
  if (sold) return fail("This price has been sold; disable it instead of deleting it.", 409);
  await prisma.price.delete({ where: { id: priceId } });
  return { data: { id: priceId } };
}

/* ------------------------------------------------------------- product types */

export async function saveProductType(id: string | null, body: Record<string, unknown>): Promise<AdminResult<{ id: string }>> {
  const parsed = validateProductType(body);
  if ("error" in parsed) return fail(parsed.error);
  const { data } = parsed;
  try {
    const saved = id
      ? await prisma.productType.update({ where: { id }, data, select: { id: true } })
      : await prisma.productType.create({ data, select: { id: true } });
    return { data: saved };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another product type already uses this key.", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return fail("Product type not found.", 404);
    throw error;
  }
}

export async function deleteProductType(id: string): Promise<AdminResult<{ id: string }>> {
  if (await prisma.product.count({ where: { typeId: id } })) return fail("Products still use this type. Move them to another type first.", 409);
  try {
    await prisma.productType.delete({ where: { id } });
  } catch {
    return fail("Product type not found.", 404);
  }
  return { data: { id } };
}

/** Admin API helper: an AdminResult as a JSON response. */
export function adminResponse<T>(result: AdminResult<T>, okStatus = 200): Response {
  return "error" in result ? Response.json({ error: result.error }, { status: result.status ?? 400 }) : Response.json(result.data, { status: okStatus });
}
