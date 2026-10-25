import { requireAdmin } from "@/lib/admin-guard";
import { adminResponse, saveProductType } from "@/lib/product-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/admin/product-types — every type (shared by all stores) with its product count. */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const types = await prisma.productType.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return Response.json({
    types: types.map(({ _count, createdAt, updatedAt, ...type }) => ({
      ...type, products: _count.products, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
    })),
  });
}

/** POST /api/admin/product-types */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  return adminResponse(await saveProductType(null, body), 201);
}
