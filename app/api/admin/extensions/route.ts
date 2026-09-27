import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { SLUG_PATTERN, isExtensionStatus, EXTENSION_STATUSES, type ExtensionStatus } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";

export const runtime = "nodejs";

/** GET /api/admin/extensions?q=&status=&page=&pageSize= */
export async function GET(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = [20, 50, 100].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 20;

  const statuses = (params.get("status") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ExtensionStatus => isExtensionStatus(value));

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { slug: { contains: q, mode: "insensitive" as const } },
            { summary: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };

  const [total, extensions] = await Promise.all([
    prisma.extension.count({ where }),
    prisma.extension.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, slug: true, name: true, summary: true, description: true, status: true,
        cover: { select: { id: true, url: true, fileName: true } },
        gallery: { orderBy: { position: "asc" }, select: { id: true, asset: { select: { id: true, url: true, fileName: true } } } },
        createdAt: true, updatedAt: true,
      },
    }),
  ]);

  // The client works with assetId/url/fileName, so the nested select is
  // flattened here rather than duplicated in every consumer.
  const flatten = (record: {
    cover: { id: string; url: string; fileName: string } | null;
    gallery: { id: string; asset: { id: string; url: string; fileName: string } }[];
  }) => ({
    ...record,
    cover: record.cover ? { assetId: record.cover.id, url: record.cover.url, fileName: record.cover.fileName } : null,
    gallery: record.gallery.map((entry) => ({
      assetId: entry.asset.id,
      url: entry.asset.url,
      fileName: entry.asset.fileName,
    })),
  });

  return Response.json({
    extensions: extensions.map((e) => ({ ...flatten(e), createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/admin/extensions */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const status = typeof body.status === "string" ? body.status : "concept";
  const coverId = typeof body.coverId === "string" ? body.coverId : null;
  const galleryIds = Array.isArray(body.galleryIds) ? body.galleryIds.filter((id): id is string => typeof id === "string") : [];

  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
  }
  if (!SLUG_PATTERN.test(slug)) {
    return Response.json({ error: "Slug may only contain lowercase letters, numbers and hyphens." }, { status: 400 });
  }
  if (summary.length < 10 || summary.length > 300) {
    return Response.json({ error: "Summary must be between 10 and 300 characters." }, { status: 400 });
  }
  if (description.length < 10) {
    return Response.json({ error: "Description is required." }, { status: 400 });
  }
  if (!isExtensionStatus(status)) {
    return Response.json({ error: `Status must be one of: ${EXTENSION_STATUSES.join(", ")}.` }, { status: 400 });
  }

  if (coverId) {
    const cover = await prisma.mediaAsset.findUnique({ where: { id: coverId }, select: { id: true } });
    if (!cover) return Response.json({ error: "Cover image not found." }, { status: 400 });
  }
  if (galleryIds.length > 12) {
    return Response.json({ error: "A gallery can hold at most 12 images." }, { status: 400 });
  }
  if (galleryIds.length > 0) {
    const found = await prisma.mediaAsset.count({ where: { id: { in: galleryIds } } });
    if (found !== galleryIds.length) {
      return Response.json({ error: "One or more gallery images could not be found." }, { status: 400 });
    }
  }

  try {
    const extension = await prisma.extension.create({
      data: {
        name, slug, summary, description, status,
        coverId: coverId ?? undefined,
        gallery: { create: galleryIds.map((assetId, position) => ({ assetId, position })) },
      },
      select: { id: true, slug: true, name: true, status: true },
    });
    return Response.json({ extension }, { status: 201 });
  } catch (error) {
    return prismaErrors(error, "The extension could not be created.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
