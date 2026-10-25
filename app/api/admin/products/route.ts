import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin-guard";
import { isProductStatus } from "@/lib/catalog-guard";
import { panelStore } from "@/lib/panel-store";
import { adminResponse, createProduct } from "@/lib/product-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/admin/products?q=&status=&type=&page=&pageSize= — the products of the panel's store. */
export async function GET(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = [20, 50, 100].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 20;
  const statuses = (params.get("status") ?? "").split(",").map((value) => value.trim()).filter(isProductStatus);
  const type = (params.get("type") ?? "").trim();

  const where: Prisma.ProductWhereInput = {
    storeId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(type ? { type: { key: type } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, slug: true, name: true, summary: true, status: true, badge: true, category: true, technologies: true, position: true,
        type: { select: { key: true, name: true } },
        cover: { select: { url: true, fileName: true } },
        prices: { select: { enabled: true } },
        _count: { select: { releases: true, orders: true } },
        updatedAt: true,
      },
    }),
  ]);

  return Response.json({
    products: rows.map(({ prices, _count, ...product }) => ({
      ...product,
      prices: prices.length,
      enabledPrices: prices.filter((price) => price.enabled).length,
      releases: _count.releases,
      orders: _count.orders,
      updatedAt: product.updatedAt.toISOString(),
    })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/admin/products — quick create: type, name and summary open a draft in the panel's store. */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await createProduct((await panelStore()).id, body), 201);
}
