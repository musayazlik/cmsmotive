import type { Metadata } from "next";
import notFoundHtml from "@/static-site/404.html";
import { parseLegacyDocument, rewriteLegacyHtml } from "@/lib/legacy-document";
import { localizeLegacyHtml } from "@/lib/i18n/legacy";
import { getRequestLocale } from "@/lib/i18n/request";
import { getTranslator } from "@/lib/i18n/translate";
import { StatusDocument } from "./_status/status-document";

/** static-site/404.html in the request's language (proxy.ts reads it from the URL). */
async function localizedDocument() {
  const locale = await getRequestLocale();
  // Not-found boundaries get no pathname; site.js points the language links at the current URL.
  return parseLegacyDocument(localizeLegacyHtml(rewriteLegacyHtml(notFoundHtml, "404.html"), locale, "/"), "404.html");
}

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslator(await getRequestLocale());
  return {
    title: (await localizedDocument()).title,
    description: t("The page you are looking for does not exist or has moved."),
    robots: { index: false, follow: true },
  };
}

/**
 * Site-wide 404 for unmatched URLs and notFound() outside the panel (which
 * has its own). The markup is static-site/404.html — edit it in build.py.
 */
export default async function NotFound() {
  return <StatusDocument document={await localizedDocument()} />;
}
