import { readCompliance, type ProductCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { readCompatibility, readLicences, type CompatibilityRow, type Licence } from "@/lib/catalog-guard";

/** An uploaded MediaAsset as the catalogue form handles it. */
export type UploadedImage = {
  assetId: string;
  url: string;
  name: string;
};

/** A theme or extension as the edit page loads it; extensions leave the theme-only fields empty. */
export type CatalogRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  industry: string;
  versionTarget: string;
  price: number | null;
  position: number;
  tagline: string;
  intro: string;
  highlights: string[];
  compatibility: CompatibilityRow[];
  licences: Licence[];
  compliance: ProductCompliance;
  ctaLabel: string;
  ctaUrl: string;
  demoUrl: string;
  cover: UploadedImage | null;
  gallery: UploadedImage[];
  /** Changelog entries and reviews, for the links to their own pages. */
  counts: { changelog: number; reviews: number; pendingReviews: number };
  createdAt: string;
  updatedAt: string;
};

const assetSelect = { select: { id: true, url: true, fileName: true } } as const;
const include = {
  cover: assetSelect,
  gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
  _count: { select: { changelog: true, reviews: true } },
} as const;

function toImage(asset: { id: string; url: string; fileName: string }): UploadedImage {
  return { assetId: asset.id, url: asset.url, name: asset.fileName };
}

function toRecord(row: {
  compliance: unknown;
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  position: number;
  tagline: string | null;
  intro: string | null;
  highlights: string[];
  compatibility: unknown;
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
  cover: { id: string; url: string; fileName: string } | null;
  gallery: { asset: { id: string; url: string; fileName: string } }[];
  _count: { changelog: number; reviews: number };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    compliance: readCompliance(row.compliance),
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    description: row.description,
    status: row.status,
    position: row.position,
    tagline: row.tagline ?? "",
    intro: row.intro ?? "",
    highlights: row.highlights,
    compatibility: readCompatibility(row.compatibility),
    ctaLabel: row.ctaLabel ?? "",
    ctaUrl: row.ctaUrl ?? "",
    demoUrl: row.demoUrl ?? "",
    cover: row.cover ? toImage(row.cover) : null,
    gallery: row.gallery.map((entry) => toImage(entry.asset)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadTheme(id: string): Promise<CatalogRecord | null> {
  const [theme, pendingReviews] = await Promise.all([
    prisma.theme.findUnique({ where: { id }, include }),
    prisma.productReview.count({ where: { themeId: id, status: "pending" } }),
  ]);
  if (!theme) return null;
  return {
    ...toRecord(theme),
    industry: theme.industry,
    versionTarget: theme.versionTarget,
    price: theme.price,
    licences: readLicences(theme.licences),
    counts: { changelog: theme._count.changelog, reviews: theme._count.reviews, pendingReviews },
  };
}

export async function loadExtension(id: string): Promise<CatalogRecord | null> {
  const [extension, pendingReviews] = await Promise.all([
    prisma.extension.findUnique({ where: { id }, include }),
    prisma.productReview.count({ where: { extensionId: id, status: "pending" } }),
  ]);
  if (!extension) return null;
  return {
    ...toRecord(extension),
    industry: "",
    versionTarget: "",
    price: null,
    licences: [],
    counts: { changelog: extension._count.changelog, reviews: extension._count.reviews, pendingReviews },
  };
}
