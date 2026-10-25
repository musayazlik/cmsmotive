import { prisma } from "./prisma";
import type { ChangeItem } from "./catalog-guard";

/** Confirms the product a changelog entry points at exists in the store before the entry is written. */
export async function productExists(storeId: string, data: { themeId: string | null; extensionId: string | null }) {
  if (data.themeId) return Boolean(await prisma.theme.findFirst({ where: { id: data.themeId, storeId }, select: { id: true } }));
  if (data.extensionId) return Boolean(await prisma.extension.findFirst({ where: { id: data.extensionId, storeId }, select: { id: true } }));
  return false;
}

/** Changelog entries have no store of their own: they belong to their theme's or extension's store. */
export function changelogInStore(storeId: string) {
  return { OR: [{ theme: { storeId } }, { extension: { storeId } }] };
}

/** Stored change lists are JSON; anything malformed is skipped rather than rendered. */
export function readChanges(value: unknown): ChangeItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChangeItem =>
      typeof item === "object" && item !== null && typeof item.text === "string" && ["new", "improved", "fixed"].includes(item.kind),
  );
}
