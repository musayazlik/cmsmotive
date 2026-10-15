import { notFound } from "next/navigation";
import { htmlResponse, readLegacyPage } from "@/lib/legacy";
import { trackPageView } from "@/lib/analytics";
import { isLocale } from "@/lib/i18n/config";
import { localizeLegacyHtml } from "@/lib/i18n/legacy";
import { injectCatalog } from "@/lib/catalog";

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
    // Product grids come from the Theme and Extension tables before the page is translated.
    const html = await injectCatalog(await readLegacyPage(`${slug}.html`));
    trackPageView(slug);
    const response = htmlResponse(localizeLegacyHtml(html, locale, slug === "index" ? "/" : `/${slug}`));
    response.headers.set("Content-Language", locale);
    return response;
  } catch (error) {
    // A page removed while the server was running; the rewrite list is built at startup.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }
}
