import { readdirSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { LOCALES, localizePath } from "@/lib/i18n/config";
import { absoluteUrl, siteOrigin } from "@/lib/seo";
import { currentStore } from "@/lib/current-store";
import { VISIBLE_STATUSES } from "@/lib/catalog-guard";

// Lists the current catalogue and journal, so it is built per request.
export const dynamic = "force-dynamic";

/** Static-site files that are not pages of their own or are served by a React route (see next.config.ts). */
const NOT_PAGES = new Set(["404", "500", "loading", "blog"]);

/**
 * Every public page in all three languages, each entry listing its language
 * versions: the static-site pages, the journal and its posts, the theme and
 * extension detail pages, and the visual builder pages (plan 5.8). Builder
 * entries list only the locales that are actually published; the legacy flow
 * answers the rest. If the database is unreachable, the static pages are
 * still listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, { store }] = await Promise.all([siteOrigin(), currentStore()]);
  const storeId = store.id;
  const defaultLocale = store.defaultLocale;
  const url = (pagePath: string, locale: (typeof LOCALES)[number]) =>
    absoluteUrl(origin, localizePath(pagePath, locale, defaultLocale));
  const pages: { path: string; lastModified?: Date }[] = readdirSync(path.join(process.cwd(), "static-site"))
    .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
    .map((file) => file.slice(0, -5))
    .filter((slug) => !NOT_PAGES.has(slug))
    .map((slug) => ({ path: slug === "index" ? "/" : `/${slug}` }));
  pages.push({ path: "/blog" });

  let builderEntries: MetadataRoute.Sitemap = [];
  try {
    const [products, posts, builderLocales] = await Promise.all([
      prisma.product.findMany({ where: { storeId, status: { in: VISIBLE_STATUSES } }, select: { slug: true, updatedAt: true } }),
      prisma.post.findMany({ where: { storeId, status: "published" }, select: { slug: true, updatedAt: true } }),
      prisma.pageLocale.findMany({
        where: { status: "published", noindex: false, page: { storeId } },
        select: { locale: true, publishedAt: true, page: { select: { slug: true } } },
      }),
    ]);
    pages.push(
      { path: "/products" },
      ...products.map((product) => ({ path: `/products/${product.slug}`, lastModified: product.updatedAt })),
      ...posts.map((post) => ({ path: `/blog/${post.slug}`, lastModified: post.updatedAt })),
    );
    builderEntries = builderLocales.map((entry) => {
      const pagePath = entry.page.slug ? `/${entry.page.slug}` : "/";
      return {
        url: url(pagePath, entry.locale as (typeof LOCALES)[number]),
        ...(entry.publishedAt ? { lastModified: entry.publishedAt } : {}),
      };
    });
  } catch (error) {
    console.error("sitemap: catalogue unavailable, listing the static pages only", error);
  }

  return [
    ...pages.flatMap((page) => {
      const languages = {
        ...Object.fromEntries(LOCALES.map((code) => [code, url(page.path, code)])),
        "x-default": url(page.path, defaultLocale),
      };
      return LOCALES.map((locale) => ({
        url: url(page.path, locale),
        ...(page.lastModified ? { lastModified: page.lastModified } : {}),
        alternates: { languages },
      }));
    }),
    ...builderEntries,
  ];
}
