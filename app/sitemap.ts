import { readdirSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { LOCALES, localizePath } from "@/lib/i18n/config";
import { absoluteUrl, siteOrigin } from "@/lib/seo";

// Lists the current catalogue and journal, so it is built per request.
export const dynamic = "force-dynamic";

/** Static-site files that are not pages of their own or are served by a React route (see next.config.ts). */
const NOT_PAGES = new Set(["404", "500", "loading", "blog"]);

/**
 * Every public page in all three languages, each entry listing its language
 * versions: the static-site pages, the journal and its posts, and the theme
 * and extension detail pages. If the database is unreachable, the static
 * pages are still listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const url = (pagePath: string, locale: (typeof LOCALES)[number]) => absoluteUrl(origin, localizePath(pagePath, locale));
  const pages: { path: string; lastModified?: Date }[] = readdirSync(path.join(process.cwd(), "static-site"))
    .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
    .map((file) => file.slice(0, -5))
    .filter((slug) => !NOT_PAGES.has(slug))
    .map((slug) => ({ path: slug === "index" ? "/" : `/${slug}` }));
  pages.push({ path: "/blog" });

  try {
    const [themes, extensions, posts] = await Promise.all([
      prisma.theme.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.extension.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.post.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
    ]);
    pages.push(
      ...themes.map((theme) => ({ path: `/theme/${theme.slug}`, lastModified: theme.updatedAt })),
      ...extensions.map((extension) => ({ path: `/extension/${extension.slug}`, lastModified: extension.updatedAt })),
      ...posts.map((post) => ({ path: `/blog/${post.slug}`, lastModified: post.updatedAt })),
    );
  } catch (error) {
    console.error("sitemap: catalogue unavailable, listing the static pages only", error);
  }

  return pages.flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((code) => [code, url(page.path, code)])), "x-default": url(page.path, "de") };
    return LOCALES.map((locale) => ({
      url: url(page.path, locale),
      ...(page.lastModified ? { lastModified: page.lastModified } : {}),
      alternates: { languages },
    }));
  });
}
