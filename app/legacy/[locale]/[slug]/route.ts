import { notFound } from "next/navigation";
import { htmlResponse, injectAdminPanelLink, injectMaintenanceNotice, readLegacyPage } from "@/lib/legacy";
import { trackPageView } from "@/lib/analytics";
import { isLocale } from "@/lib/i18n/config";
import { localizeLegacyHtml } from "@/lib/i18n/legacy";
import { injectCatalog } from "@/lib/catalog";
import { addLegacySeo, siteOrigin } from "@/lib/seo";
import { getMaintenanceSettings, getSeoSettings, getSiteSettings } from "@/lib/settings";
import { injectTestimonials } from "@/lib/testimonials";
import { hasPanelSession } from "@/lib/public-session";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getTranslator } from "@/lib/i18n/translate";

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
    trackPageView(slug);
    const pagePath = slug === "index" ? "/" : `/${slug}`;
    // Search tags and JSON-LD are read from the translated page, so they match its language.
    let localized = localizeLegacyHtml(base, locale, pagePath);
    // Inject after URL localization: private admin paths never get a public language prefix.
    const showAdmin = await hasPanelSession();
    if (showAdmin) {
      const t = getTranslator(locale);
      const [admin, maintenance] = await Promise.all([getAdminAccessSettings(), getMaintenanceSettings()]);
      localized = injectAdminPanelLink(localized, admin.panelPath, t("Admin panel"));
      if (maintenance.enabled) {
        localized = injectMaintenanceNotice(localized, t("This site is currently in maintenance mode."));
      }
    }
    const [site, seo, origin] = await Promise.all([getSiteSettings(), getSeoSettings(), siteOrigin()]);
    const response = htmlResponse(addLegacySeo(localized, { origin, locale, pagePath, site, seo }));
    if (showAdmin) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Vary", "Cookie");
    }
    response.headers.set("Content-Language", locale);
    return response;
  } catch (error) {
    // A page removed while the server was running; the rewrite list is built at startup.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }
}
