import { Prisma } from "@/generated/prisma/client";
import { PRODUCT_STATUSES, isProductStatus, validateDetail, validateProduct, validateProductType } from "@/lib/catalog-guard";
import { creemMode, creemRequest } from "@/lib/creem";
import { CREEM_BILLING_PERIOD, creemProductMismatch, isBillingInterval, validatePrice } from "@/lib/prices";
import { DELIVERY_NOTE_LIMIT, publicationMissing, validateCompliance } from "@/lib/product-compliance";
import { productReadiness } from "@/lib/product-readiness";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

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

/** A product of the store, or null. Every product belongs to exactly one store. */
export function findStoreProduct(storeId: string, id: string) {
  return prisma.product.findFirst({ where: { id, storeId }, select: { id: true, storeId: true, slug: true, status: true } });
}

/** `base`, else `base-2`, `base-3` … — the first slug still free in the store. */
async function freeSlug(storeId: string, base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let counter = 1; ; counter++) {
    const candidate = counter === 1 ? root : `${root}-${counter}`;
    const taken = await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } });
    if (!taken || taken.id === excludeId) return candidate;
  }
}

/** Quick create: type, name and summary open a draft; everything else is filled in on its tabs. */
export async function createProduct(storeId: string, body: Record<string, unknown>): Promise<AdminResult<{ id: string; slug: string }>> {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const name = text("name");
  const summary = text("summary");
  const typeId = text("typeId");
  if (name.length < 2 || name.length > 80) return fail("Name must be between 2 and 80 characters.");
  if (summary.length < 10 || summary.length > 300) return fail("Summary must be between 10 and 300 characters.");
  if (!typeId || !(await prisma.productType.findUnique({ where: { id: typeId }, select: { id: true } }))) return fail("Choose the product type.");
  const last = await prisma.product.aggregate({ where: { storeId }, _max: { position: true } });
  const product = await prisma.product.create({
    data: {
      storeId, typeId, name, summary, description: "", status: "draft",
      slug: await freeSlug(storeId, name),
      position: (last._max.position ?? 0) + 10,
    },
    select: { id: true, slug: true },
  });
  return { data: product };
}

/**
 * Saves the General tab: identity, description, media, card fields and the
 * detail-page fields. Status and the package checklist are saved on their own
 * tabs. Images must come from the store's media library.
 */
export async function saveProduct(storeId: string, id: string, body: Record<string, unknown>): Promise<AdminResult<{ id: string; slug: string }>> {
  const product = validateProduct(body);
  if ("error" in product) return fail(product.error);
  const detail = validateDetail(body);
  if ("error" in detail) return fail(detail.error);

  const current = await findStoreProduct(storeId, id);
  if (!current) return fail("Product not found.", 404);
  if (!(await prisma.productType.findUnique({ where: { id: product.data.typeId }, select: { id: true } }))) {
    return fail("The chosen product type no longer exists.");
  }
  const assets = [product.data.coverId, ...product.data.galleryIds].filter((asset): asset is string => Boolean(asset));
  if (assets.length && (await prisma.mediaAsset.count({ where: { id: { in: assets }, storeId } })) !== new Set(assets).size) {
    return fail("One or more selected images could not be found in this store's media library.");
  }

  const { galleryIds, ...fields } = product.data;
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.product.update({ where: { id: current.id }, data: { ...fields, ...detail.data }, select: { id: true, slug: true } });
      await tx.productGallery.deleteMany({ where: { productId: row.id } });
      if (galleryIds.length) {
        await tx.productGallery.createMany({ data: galleryIds.map((assetId, index) => ({ productId: row.id, assetId, position: index })) });
      }
      return row;
    });
    return { data: saved };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another product of this store already uses this slug.", 409);
    throw error;
  }
}

/** Saves the package checklist (Packages tab). A published product must keep it complete. */
export async function saveCompliance(storeId: string, id: string, body: Record<string, unknown>): Promise<AdminResult<{ id: string }>> {
  const current = await findStoreProduct(storeId, id);
  if (!current) return fail("Product not found.", 404);
  const compliance = validateCompliance(body.compliance ?? body);
  if ("error" in compliance) return fail(compliance.error);
  if (current.status === "published" && publicationMissing(compliance.data).length) {
    return fail("A published product needs a complete package checklist. Move it back to preview first.");
  }
  await prisma.product.update({ where: { id }, data: { compliance: compliance.data } });
  return { data: { id } };
}

/**
 * Saves what buyers receive besides the packages (Packages tab): our own
 * licence key per purchase and a plain-text note in their account. Creem only
 * takes the payment; delivery never depends on its product settings.
 */
export async function saveDelivery(storeId: string, id: string, body: Record<string, unknown>): Promise<AdminResult<{ id: string }>> {
  const current = await findStoreProduct(storeId, id);
  if (!current) return fail("Product not found.", 404);
  const note = typeof body.deliveryNote === "string" ? body.deliveryNote.replace(/\r\n/g, "\n").trim() : "";
  if (note.length > DELIVERY_NOTE_LIMIT) return fail(`The note can be at most ${DELIVERY_NOTE_LIMIT.toLocaleString("en-US")} characters.`);
  await prisma.product.update({ where: { id }, data: { issueLicenseKeys: body.issueLicenseKeys === true, deliveryNote: note || null } });
  return { data: { id } };
}

/** Changes the status (Publish tab); publishing requires every ready-to-sell item. */
export async function setProductStatus(storeId: string, id: string, status: unknown): Promise<AdminResult<{ id: string; status: string }>> {
  if (!isProductStatus(status)) return fail(`Status must be one of: ${PRODUCT_STATUSES.join(", ")}.`);
  const current = await findStoreProduct(storeId, id);
  if (!current) return fail("Product not found.", 404);
  if (status === "published") {
    const readiness = await productReadiness(id);
    const missing = readiness?.items.filter((item) => !item.ok).map((item) => item.label) ?? [];
    if (missing.length) return fail(`Not ready to sell yet: ${missing.join(", ")}.`);
  }
  await prisma.product.update({ where: { id }, data: { status } });
  return { data: { id, status } };
}

/**
 * Copies a product into another store as a draft: content, its cover and
 * gallery (added to that store's media library), changelog, and its prices
 * as drafts without Creem products (each store sells in its own currency).
 * Packages are uploaded again in the copy, reviews stay with the original.
 */
export async function copyProductToStore(storeId: string, id: string, targetStoreId: string): Promise<AdminResult<{ id: string; slug: string }>> {
  if (targetStoreId === storeId) return fail("Choose another store.");
  const source = await prisma.product.findFirst({
    where: { id, storeId },
    include: {
      cover: true,
      gallery: { orderBy: { position: "asc" }, include: { asset: true } },
      changelog: true,
      prices: true,
    },
  });
  if (!source) return fail("Product not found.", 404);
  if (!(await prisma.store.findUnique({ where: { id: targetStoreId }, select: { id: true } }))) return fail("That store does not exist.", 404);

  const copy = await prisma.$transaction(async (tx) => {
    // The target store gets its own media rows for the same files (one storage bucket serves every store).
    const assetIds = new Map<string, string>();
    for (const asset of [source.cover, ...source.gallery.map((entry) => entry.asset)]) {
      if (!asset || assetIds.has(asset.id)) continue;
      const { id: _id, storeId: _store, createdAt: _created, ...file } = asset;
      const row = await tx.mediaAsset.upsert({
        where: { storeId_key: { storeId: targetStoreId, key: asset.key } },
        create: { ...file, storeId: targetStoreId },
        update: {},
        select: { id: true },
      });
      assetIds.set(asset.id, row.id);
    }
    const last = await tx.product.aggregate({ where: { storeId: targetStoreId }, _max: { position: true } });
    const product = await tx.product.create({
      data: {
        storeId: targetStoreId, typeId: source.typeId, status: "draft",
        slug: await freeSlug(targetStoreId, source.slug),
        name: source.name, summary: source.summary, description: source.description,
        badge: source.badge, category: source.category, technologies: source.technologies,
        tagline: source.tagline, intro: source.intro, highlights: source.highlights,
        compatibility: source.compatibility as Prisma.InputJsonValue, compliance: source.compliance as Prisma.InputJsonValue,
        ctaLabel: source.ctaLabel, ctaUrl: source.ctaUrl, demoUrl: source.demoUrl,
        issueLicenseKeys: source.issueLicenseKeys, deliveryNote: source.deliveryNote,
        coverId: source.coverId ? assetIds.get(source.coverId) : null,
        position: (last._max.position ?? 0) + 10,
        gallery: { create: source.gallery.map((entry) => ({ assetId: assetIds.get(entry.assetId)!, position: entry.position })) },
        changelog: {
          create: source.changelog.map(({ version, title, releasedAt, changes }) => ({ version, title, releasedAt, changes: changes as Prisma.InputJsonValue })),
        },
        prices: {
          create: source.prices.map(({ name, billingType, interval, amountCents, currency, taxMode, updatesMonths, seats, features, position }) => ({
            name, billingType, interval, amountCents, currency, taxMode, updatesMonths, seats, features, position, enabled: false,
          })),
        },
      },
      select: { id: true, slug: true },
    });
    return product;
  });
  return { data: copy };
}

/** Deletes a product unless it has sales; sold products are kept for their customers' downloads. */
export async function deleteProduct(storeId: string, id: string): Promise<AdminResult<{ id: string }>> {
  const product = await findStoreProduct(storeId, id);
  if (!product) return fail("Product not found.", 404);
  const sales = await prisma.order.count({ where: { productId: id } }) + (await prisma.subscription.count({ where: { productId: id } }));
  if (sales > 0) return fail("This product has orders or subscriptions. Set it back to draft instead of deleting it.", 409);
  await prisma.product.delete({ where: { id } });
  return { data: { id } };
}

/* -------------------------------------------------------------------- prices */

/**
 * Creates (priceId = null) or updates a price of a store's product. Putting
 * it on sale creates (or updates) its Creem product through the API; a Creem
 * product ID is only entered to link a product that already exists in Creem.
 * Prices follow their product's store and currency.
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

  const current = priceId ? await prisma.price.findFirst({ where: { id: priceId, productId } }) : null;
  if (priceId && !current) return fail("Price not found.", 404);
  if (current) {
    const sold = await prisma.order.count({ where: { priceId: current.id } }) + (await prisma.subscription.count({ where: { priceId: current.id } }));
    const changesTerms =
      current.billingType !== price.billingType || current.interval !== price.interval ||
      current.amountCents !== price.amountCents || current.currency !== price.currency;
    if (sold && changesTerms) return fail("This price has been sold. Create a new price for new terms and take this one off sale.", 409);
    if (current.enabled && !price.enabled && product.status === "published") {
      const others = await prisma.price.count({ where: { productId, enabled: true, id: { not: current.id } } });
      if (!others) return fail("This is the only price on sale of a published product. Move the product back to preview first.", 409);
    }
  }

  // The row is saved first and only goes on sale once Creem holds a matching product.
  const { enabled, creemProductId, ...terms } = price;
  const link = creemProductId ? { [creemMode() === "prod" ? "creemLiveProductId" : "creemTestProductId"]: creemProductId } : {};
  let saved: { id: string };
  try {
    saved = current
      ? await prisma.price.update({ where: { id: current.id }, data: { ...terms, ...link, enabled: enabled && current.enabled }, select: { id: true } })
      : await prisma.price.create({ data: { ...terms, ...link, enabled: false, productId }, select: { id: true } });
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another price already uses this Creem product ID.", 409);
    throw error;
  }
  if (!enabled) {
    await prisma.price.update({ where: { id: saved.id }, data: { enabled: false } });
    return { data: saved };
  }

  const synced = await syncCreemProduct(saved.id);
  if ("error" in synced) return fail(`The price was saved but stays off sale: ${synced.error}`, synced.status);
  await prisma.price.update({ where: { id: saved.id }, data: { enabled: true } });
  return { data: saved };
}

/**
 * Makes sure the price has a Creem product in the current payment mode that
 * sells exactly its terms: creates one through the API when none is linked
 * yet (idempotent per price and mode, so a retry never duplicates it), and
 * brings a linked one in line when it drifted. The product ID is stored on
 * the price. Nothing has to be set up in the Creem dashboard.
 */
export async function syncCreemProduct(priceId: string): Promise<AdminResult<{ creemProductId: string }>> {
  const price = await prisma.price.findUnique({
    where: { id: priceId },
    include: { product: { select: { name: true, summary: true, cover: { select: { url: true } } } } },
  });
  if (!price) return fail("Price not found.", 404);
  const mode = creemMode();
  const field = mode === "prod" ? "creemLiveProductId" : "creemTestProductId";
  const linked = price[field];
  const desired = {
    name: `${price.product.name} — ${price.name}`.slice(0, 120),
    description: price.product.summary,
    price: price.amountCents,
    currency: price.currency,
    billing_type: price.billingType,
    ...(price.billingType === "recurring" && isBillingInterval(price.interval) ? { billing_period: CREEM_BILLING_PERIOD[price.interval] } : {}),
    tax_mode: price.taxMode,
    ...(price.product.cover && /^https:\/\//.test(price.product.cover.url) ? { image_url: price.product.cover.url } : {}),
  };

  try {
    if (!linked) {
      const created = await creemRequest("/v1/products", desired, { "Idempotency-Key": `price-${price.id}-${mode}` });
      const id = typeof created.id === "string" ? created.id : null;
      if (!id) return fail("Creem did not return a product ID.", 502);
      await prisma.price.update({ where: { id: price.id }, data: { [field]: id } });
      return { data: { creemProductId: id } };
    }
    const remote = await creemRequest(`/v1/products/${encodeURIComponent(linked)}`);
    if (creemProductMismatch(remote, price) || remote.name !== desired.name) {
      await creemRequest(`/v1/products/${encodeURIComponent(linked)}`, desired, undefined, "PATCH");
      const mismatch = creemProductMismatch(await creemRequest(`/v1/products/${encodeURIComponent(linked)}`), price);
      if (mismatch) return fail(mismatch);
    }
    return { data: { creemProductId: linked } };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another price already uses this Creem product.", 409);
    return fail(error instanceof Error ? error.message : "Creem could not be reached.", 502);
  }
}

export async function deletePrice(storeId: string, priceId: string): Promise<AdminResult<{ id: string }>> {
  const price = await prisma.price.findFirst({ where: { id: priceId, product: { storeId } }, select: { id: true } });
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
