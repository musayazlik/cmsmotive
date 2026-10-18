import type { MetadataRoute } from "next";
import { BUILT_IN_DISALLOW } from "@/lib/seo-settings-shared";
import { siteOrigin } from "@/lib/seo";
import { getSeoSettings } from "@/lib/settings";

// Follows Settings → SEO, so it is built per request.
export const dynamic = "force-dynamic";

/**
 * The public site is open to crawlers; the account area, auth flows, APIs and
 * the internal page handler are not, nor the extra paths from Settings → SEO.
 * With indexing switched off there (staging), everything is disallowed.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [origin, seo] = await Promise.all([siteOrigin(), getSeoSettings()]);
  if (!seo.indexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...BUILT_IN_DISALLOW, ...seo.robotsDisallow] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
