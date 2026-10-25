import { prisma } from "@/lib/prisma";
import type { ProductOption } from "./_lib";

/** Every theme and extension of the store as a product choice, themes first, each group by name. */
export async function productOptions(storeId: string): Promise<ProductOption[]> {
  const [themes, extensions] = await Promise.all([
    prisma.theme.findMany({ where: { storeId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.extension.findMany({ where: { storeId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return [
    ...themes.map((theme) => ({ value: `theme:${theme.id}`, label: `Theme · ${theme.name}` })),
    ...extensions.map((extension) => ({ value: `extension:${extension.id}`, label: `Extension · ${extension.name}` })),
  ];
}
