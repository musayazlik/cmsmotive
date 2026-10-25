import { prisma } from "./prisma";
import type { ChangeItem } from "./catalog-guard";

/** Confirms the product a changelog entry points at exists in the store before the entry is written. */
export async function productExists(storeId: string, productId: string) {
  return Boolean(
    await prisma.product.findFirst({
      where: { id: productId, OR: [{ storeId }, { listings: { some: { storeId } } }] },
      select: { id: true },
    }),
  );
}

/** Changelog entries have no store of their own: they belong to their product's store. */
export function changelogInStore(storeId: string) {
  return { product: { OR: [{ storeId }, { listings: { some: { storeId } } }] } };
}

/** Stored change lists are JSON; anything malformed is skipped rather than rendered. */
export function readChanges(value: unknown): ChangeItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChangeItem =>
      typeof item === "object" && item !== null && typeof item.text === "string" && ["new", "improved", "fixed"].includes(item.kind),
  );
}
