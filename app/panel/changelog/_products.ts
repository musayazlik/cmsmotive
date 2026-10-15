import { prisma } from "@/lib/prisma";
import type { ProductOption } from "./_lib";

/** Every theme and extension as a product choice, themes first, each group by name. */
export async function productOptions(): Promise<ProductOption[]> {
  const [themes, extensions] = await Promise.all([
    prisma.theme.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.extension.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return [
    ...themes.map((theme) => ({ value: `theme:${theme.id}`, label: `Theme · ${theme.name}` })),
    ...extensions.map((extension) => ({ value: `extension:${extension.id}`, label: `Extension · ${extension.name}` })),
  ];
}
