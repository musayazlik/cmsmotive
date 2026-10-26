import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Render } from "@puckeditor/core";
import { trackPageView } from "@/lib/analytics";
import { currentStore, currentStoreId } from "@/lib/current-store";
import { walkBlocks, type PageBuilderData } from "@/lib/page-builder/data";
import { serverConfig } from "@/lib/page-builder/config.server";
import { renderableDocument } from "@/lib/page-builder/document";
import { findPublishedPageLocale, type PublishedPageView } from "@/lib/page-builder/pages";
import { isLocale, localizePath, type Locale } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/seo";
import { SiteFrame } from "../../_components/site-chrome";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug?: string[] }> };

/**
 * A published builder page (plan 5.8). The proxy has already matched the URL
 * against the store's published page registry and rewritten unprefixed slugs
 * here with the default locale as the first segment; this route loads the one
 * published version and renders it inside the public site frame. Everything
 * unclaimed falls through to the regular 404, so a page can go back to the
 * legacy flow the moment it is unpublished.
 *
 * Only server code is imported: `Render` with config.server keeps the editor
 * runtime out of the public bundle (plan 5.16), and the document is validated
 * and cleaned on every read because `<Render>` prints rich text as stored
 * (plan 5.13).
 */

/** One store/page/locale query per request, shared by metadata and render. */
const findPage = cache(findPublishedPageLocale);

/** The meta description: the SEO field, else the first text the document shows. */
function pageDescription(view: PublishedPageView): string {
  if (view.locale.seoDescription) return view.locale.seoDescription;
  let summary = "";
  walkBlocks(view.locale.published, (block) => {
    if (summary) return;
    const props = (block.props ?? {}) as { text?: unknown; content?: unknown };
    for (const value of [props.text, props.content]) {
      if (typeof value !== "string") continue;
      const plain = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) {
        summary = plain.slice(0, 160);
        return;
      }
    }
  });
  return summary || view.locale.title;
}

/**
 * Metadata through lib/seo.ts pageMetadata, with two builder-specific
 * overrides (plan 5.9): hreflang lists only the locales this slug is actually
 * published in (the legacy pages answer the rest), and the per-locale noindex
 * switch wins over the global SEO setting.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam) || !slug?.length) return {};
  const path = slug.join("/");
  const [store, view] = await Promise.all([currentStore(), findPage((await currentStoreId()), path, localeParam)]);
  if (!view) return {};
  const metadata = await pageMetadata({
    locale: localeParam,
    path: `/${path}`,
    title: view.locale.seoTitle ?? view.locale.title,
    description: pageDescription(view),
    image: view.ogImage
      ? { url: view.ogImage.url, width: view.ogImage.width ?? undefined, height: view.ogImage.height ?? undefined }
      : null,
  });
  const published = new Set(view.publishedLocales);
  const defaultLocale = store.store.defaultLocale;
  const languages: Record<string, string> = {};
  for (const code of published) languages[code] = localizePath(`/${path}`, code as Locale);
  if (published.has(defaultLocale)) languages["x-default"] = localizePath(`/${path}`, defaultLocale);
  metadata.alternates = { ...metadata.alternates, languages };
  if (view.locale.noindex) metadata.robots = { index: false, follow: true };
  return metadata;
}

export default async function BuilderPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  // The builder home page (slug "") inherits the root address in Faz 3; until
  // then every root URL keeps its legacy flow, so an empty slug 404s here.
  if (!slug?.length) notFound();
  const path = slug.join("/");
  const storeId = await currentStoreId();
  const view = await findPage(storeId, path, localeParam);
  if (!view) notFound();
  const document: PageBuilderData | null = renderableDocument(view.locale.published);
  if (!document) notFound();

  trackPageView(storeId, `page-${path}`);

  return (
    <SiteFrame locale={localeParam} path={`/${path}`} current={`/${slug[0]}`}>
      {/* Same static layers as the editor canvas (plan 5.6): fonts come from the root layout. */}
      <link rel="stylesheet" href="/assets/css/site.css" precedence="default" />
      <link rel="stylesheet" href="/assets/css/pb-blocks.css" precedence="default" />
      {/* Scoped styles compiled at publish time stay the top layer of the cascade (plan 5.4). */}
      {view.locale.publishedCss ? <style dangerouslySetInnerHTML={{ __html: view.locale.publishedCss }} /> : null}
      <div className="pb-render">
        <Render config={serverConfig} data={document} />
      </div>
    </SiteFrame>
  );
}
