import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

const PAGE_SIZE = 36;

/**
 * GET /api/admin/media?kind=image|video&q=&page=
 * The media picker's view of the library: tracked uploads of one kind, newest first.
 */
export async function GET(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "video" ? "video" : "image";
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);

  const where = {
    mimeType: { startsWith: `${kind}/` },
    ...(q
      ? {
          OR: [
            { fileName: { contains: q, mode: "insensitive" as const } },
            { alt: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, assets] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, url: true, fileName: true, mimeType: true, fileSize: true, alt: true, width: true, height: true, createdAt: true },
    }),
  ]);

  return Response.json({
    items: assets.map((asset) => ({
      assetId: asset.id,
      url: asset.url,
      name: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.fileSize,
      alt: asset.alt,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString(),
    })),
    total,
    page,
    hasMore: page * PAGE_SIZE < total,
  });
}
