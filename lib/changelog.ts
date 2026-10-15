import { prisma } from "./prisma";
import type { ChangeItem } from "./catalog-guard";

/** Confirms the product a changelog entry points at exists before the entry is written. */
export async function productExists(data: { themeId: string | null; extensionId: string | null }) {
  if (data.themeId) return Boolean(await prisma.theme.findUnique({ where: { id: data.themeId }, select: { id: true } }));
  if (data.extensionId) return Boolean(await prisma.extension.findUnique({ where: { id: data.extensionId }, select: { id: true } }));
  return false;
}

/** Stored change lists are JSON; anything malformed is skipped rather than rendered. */
export function readChanges(value: unknown): ChangeItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChangeItem =>
      typeof item === "object" && item !== null && typeof item.text === "string" && ["new", "improved", "fixed"].includes(item.kind),
  );
}
