import { siteOrigin } from "@/lib/seo";
import { generatedRobotsTxt } from "@/lib/seo-settings-shared";
import { getSeoSettings } from "@/lib/settings";
import { currentStoreId } from "@/lib/current-store";

/**
 * The public robot policy from Settings → SEO, built per request:
 *
 * - Indexing switched off (staging): `Disallow: /` for everybody, regardless
 *   of any custom content, so a half-finished site is never crawled.
 * - Then, with a custom robots.txt written in the settings: that file verbatim.
 * - Otherwise: the generated policy from the extra disallow paths, listing
 *   the sitemap that indexes every public page.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const [origin, seo] = await Promise.all([siteOrigin(), getSeoSettings(await currentStoreId())]);
  const custom = seo.robotsCustom.trim();
  const body = !seo.indexing || !custom ? generatedRobotsTxt(origin, seo) : custom;

  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
