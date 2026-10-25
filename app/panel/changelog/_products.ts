import { prisma } from "@/lib/prisma";
import type { ProductOption } from "./_lib";

/** Every product the store owns or lists, by name. */
export async function productOptions(storeId: string): Promise<ProductOption[]> {
  const products = await prisma.product.findMany({
    where: { OR: [{ storeId }, { listings: { some: { storeId } } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return products.map((product) => ({ value: product.id, label: product.name }));
}
