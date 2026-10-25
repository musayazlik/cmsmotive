import { readCompliance, type ProductCompliance } from "./product-compliance";
import { creemMode, creemConfigured } from "./creem";
import { getLegalSettings } from "./legal";
import { legalReadiness } from "./legal-settings-shared";
import { prisma } from "./prisma";
import { readChanges } from "./changelog";
import { readCompatibility, readLicences, type ChangeItem, type CompatibilityRow, type Licence } from "./catalog-guard";

export type ProductKind = "theme" | "extension";

type Image = { url: string; alt: string; width: number; height: number };

/**
 * Everything a theme or extension detail page (/theme/<slug>,
 * /extension/<slug>) shows, all edited under /panel. Extensions leave the
 * theme-only fields (industry, version target, price, licences) empty.
 */
export type ProductPageData = {
  kind: ProductKind;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  tagline: string | null;
  intro: string | null;
  industry: string | null;
  versionTarget: string | null;
  price: number | null;
  licences: Licence[];
  plans: {id:string;name:string;priceCents:number;installations:number}[];
  checkout: { mode: "test" | "prod"; ready: boolean; termsVersion: string };
  compliance: ProductCompliance;
  highlights: string[];
  compatibility: CompatibilityRow[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
  cover: Image | null;
  gallery: Image[];
  /** Newest release first. */
  changelog: { id: string; version: string; title: string; releasedAt: Date; changes: ChangeItem[] }[];
};

const assetSelect = { select: { url: true, alt: true, fileName: true, width: true, height: true } } as const;
const changelogArgs = {
  orderBy: [{ releasedAt: "desc" as const }, { createdAt: "desc" as const }],
  select: { id: true, version: true, title: true, releasedAt: true, changes: true },
} as const;

function toImage(asset: { url: string; alt: string | null; fileName: string; width: number | null; height: number | null }): Image {
  return {
    url: asset.url,
    alt: asset.alt ?? asset.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
    width: asset.width ?? 1536,
    height: asset.height ?? 1024,
  };
}

function common(row: {
  compliance: unknown;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  tagline: string | null;
  intro: string | null;
  highlights: string[];
  compatibility: unknown;
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
  cover: Parameters<typeof toImage>[0] | null;
  gallery: { asset: Parameters<typeof toImage>[0] }[];
  changelog: { id: string; version: string; title: string; releasedAt: Date; changes: unknown }[];
}) {
  return {
    slug: row.slug,
    compliance: readCompliance(row.compliance),
    name: row.name,
    summary: row.summary,
    description: row.description,
    status: row.status,
    tagline: row.tagline,
    intro: row.intro,
    highlights: row.highlights,
    compatibility: readCompatibility(row.compatibility),
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl,
    demoUrl: row.demoUrl,
    cover: row.cover ? toImage(row.cover) : null,
    gallery: row.gallery.map((entry) => toImage(entry.asset)),
    changelog: row.changelog.map((entry) => ({ ...entry, changes: readChanges(entry.changes) })),
  };
}

/** The product page of `slug` in a store's catalogue, with the store's checkout readiness and plans. */
export async function loadProductPage(storeId: string, kind: ProductKind, slug: string): Promise<ProductPageData | null> {
  const legal = await getLegalSettings(storeId);
  const mode = creemMode();
  const checkout: ProductPageData["checkout"] = { mode, ready: creemConfigured() && (mode === "test" || (!legalReadiness(legal).length && legal.salesTermsReviewed)), termsVersion: legal.termsVersion };
  const plans = await prisma.billingPlan.findMany({where:{storeId,kind,productSlug:slug,enabled:true,...(creemMode()==="prod"?{creemLiveProductId:{not:null}}:{creemTestProductId:{not:null}})},select:{id:true,name:true,priceCents:true,installations:true},orderBy:{priceCents:"asc"}});
  if (kind === "theme") {
    const theme = await prisma.theme.findUnique({
      where: { storeId_slug: { storeId, slug } },
      include: {
        cover: assetSelect,
        gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
        changelog: { orderBy: [...changelogArgs.orderBy], select: changelogArgs.select },
      },
    });
    if (!theme) return null;
    return {
      kind,
      plans,
      checkout,
      ...common(theme),
      industry: theme.industry,
      versionTarget: theme.versionTarget,
      price: theme.price,
      licences: readLicences(theme.licences),
    };
  }
  const extension = await prisma.extension.findUnique({
    where: { storeId_slug: { storeId, slug } },
    include: {
      cover: assetSelect,
      gallery: { orderBy: { position: "asc" }, select: { asset: assetSelect } },
      changelog: { orderBy: [...changelogArgs.orderBy], select: changelogArgs.select },
    },
  });
  if (!extension) return null;
  return { kind, plans, checkout, ...common(extension), industry: null, versionTarget: null, price: null, licences: [] };
}
