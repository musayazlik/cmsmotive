import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";

/** The public site is open to crawlers; the account area, auth flows, APIs and the internal page handler are not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/auth/", "/api/", "/legacy/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
