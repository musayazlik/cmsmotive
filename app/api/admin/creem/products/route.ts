import { requireAdmin } from "@/lib/admin-guard";
import { creemConfigured, creemMode, searchCreemProducts } from "@/lib/creem";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/admin/creem/products — the products of the active Creem environment
 * for the price form's picker. `linked` maps every Creem product ID a local
 * price already uses (the columns are globally unique) to that price, so the
 * picker can mark them taken.
 */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  if (!creemConfigured()) {
    return Response.json(
      { error: "Add CREEM_API_KEY and CREEM_WEBHOOK_SECRET in the server environment." },
      { status: 400 },
    );
  }

  let items;
  try {
    items = await searchCreemProducts();
  } catch {
    return Response.json({ error: "Creem products could not be loaded." }, { status: 502 });
  }

  const ids = items.map((item) => item.id);
  const linkedPrices = ids.length
    ? await prisma.price.findMany({
        where: { OR: [{ creemTestProductId: { in: ids } }, { creemLiveProductId: { in: ids } }] },
        select: { name: true, creemTestProductId: true, creemLiveProductId: true, product: { select: { name: true } } },
      })
    : [];
  const linked: Record<string, string> = {};
  for (const price of linkedPrices) {
    const label = `${price.product.name} — ${price.name}`;
    if (price.creemTestProductId) linked[price.creemTestProductId] = label;
    if (price.creemLiveProductId) linked[price.creemLiveProductId] = label;
  }

  return Response.json({
    mode: creemMode(),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      amountCents: item.price,
      currency: item.currency,
      billingType: item.billing_type,
      billingPeriod: item.billing_period ?? null,
      taxMode: item.tax_mode ?? null,
      status: item.status ?? null,
    })),
    linked,
  });
}
