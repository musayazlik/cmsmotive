import { notFound } from "next/navigation";
import { htmlResponse, injectAdminPanelLink, readLegacyPage } from "@/lib/legacy";
import { trackPageView } from "@/lib/analytics";
import { isLocale } from "@/lib/i18n/config";
import { localizeLegacyHtml } from "@/lib/i18n/legacy";
import { injectCatalog } from "@/lib/catalog";
import { addLegacySeo, siteOrigin } from "@/lib/seo";
import { getSeoSettings, getSiteSettings } from "@/lib/settings";
import { injectTestimonials } from "@/lib/testimonials";
import { hasPanelSession } from "@/lib/public-session";

export const runtime = "nodejs";

/**
 * Serves the prerendered static-site pages in each site language. Only
 * reachable through the rewrites in next.config.ts (`/about` ->
 * `/legacy/de/about`, `/en/about` -> `/legacy/en/about`), which list the
 * existing pages explicitly, so unknown URLs never land here and render
 * app/not-found.tsx instead. Direct `/legacy/*` requests are blocked there too.
 */
export async function GET(_request: Request, context: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await context.params;
  if (!isLocale(locale) || !/^[a-z0-9-]+$/.test(slug)) notFound();
  try {
    // Product grids and review quotes come from the database before the page is translated.
    const base = await injectTestimonials(await injectCatalog(await readLegacyPage(`${slug}.html`)));
    // Signed-in visitors get the admin-panel link; injected before translation so it localizes too.
    const html = (await hasPanelSession()) ? injectAdminPanelLink(base) : base;
    trackPageView(slug);
    const pagePath = slug === "index" ? "/" : `/${slug}`;
    // Search tags and JSON-LD are read from the translated page, so they match its language.
    const localized = localizeLegacyHtml(html, locale, pagePath);
    const [site, seo, origin] = await Promise.all([getSiteSettings(), getSeoSettings(), siteOrigin()]);
    const response = htmlResponse(addLegacySeo(localized, { origin, locale, pagePath, site, seo }));
    response.headers.set("Content-Language", locale);
    return response;
  } catch (error) {
    // A page removed while the server was running; the rewrite list is built at startup.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }
}
