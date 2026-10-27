import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@puckeditor/core";
import { prisma } from "@/lib/prisma";
import { hasPanelSession } from "@/lib/public-session";
import { currentStoreId } from "@/lib/current-store";
import { serverConfig } from "@/lib/page-builder/config.server";
import { renderableDocument } from "@/lib/page-builder/document";
import { isValidPagePreview } from "@/lib/page-builder/preview-token";
import { usedFontFiles } from "@/lib/page-builder/fonts";
import { resolveLivePageData } from "@/lib/page-builder/live-data";
import { getThemeSettings } from "@/lib/settings";
import { themeToCssVariables } from "@/lib/page-builder/theme";
import { compileDocumentCss } from "@/lib/page-builder/style/css";
import { isLocale } from "@/lib/i18n/config";
import { SiteFrame } from "@/app/[locale]/_components/site-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page draft preview",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string; t?: string; exp?: string }>;
};

/**
 * The draft of one page language, rendered inside the public site frame
 * (plan 5.7). The door is a panel session or a signed, expiring preview link
 * (lib/page-builder/preview-token.ts) — the panel's "Preview" button hands
 * out the link so a draft can be reviewed without a panel account. The route
 * deliberately sits outside app/panel: the panel layout's stylesheets would
 * bleed into the public-site preview, and the token door would fight the
 * layout's session redirect. proxy.ts marks /pb-preview/* noindex.
 *
 * Editor runtime stays out of this route like every public render (plan 5.16),
 * and the draft is validated and cleaned on every read (plan 5.13).
 */
export default async function PagePreviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { locale: localeParam, t, exp } = await searchParams;
  if (!isLocale(localeParam)) notFound();
  const storeId = await currentStoreId();
  if (!(await hasPanelSession()) && !isValidPagePreview(storeId, id, localeParam, t, exp)) notFound();
  const row = await prisma.pageLocale.findFirst({
    where: { locale: localeParam, page: { id, storeId } },
    select: { draft: true, page: { select: { slug: true } } },
  });
  if (!row) notFound();
  const rawDocument = renderableDocument(row.draft);
  if (!rawDocument) {
    return (
      <main className="container">
        <p>This draft no longer validates; open the editor and save it again.</p>
      </main>
    );
  }
  const document = await resolveLivePageData(rawDocument, storeId, localeParam);
  const path = row.page.slug ? `/${row.page.slug}` : "/";
  return (
    <SiteFrame locale={localeParam} path={path} current={row.page.slug ? `/${row.page.slug}` : "/"}>
      {/* Draft fonts, computed live — publish stores the list for the live page (plan 5.5). */}
      {usedFontFiles(document).map((file) => (
        <link key={file} rel="preload" href={file} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      {/* Same static layers as the editor canvas and the published page. */}
      <link rel="stylesheet" href="/assets/css/site.css" precedence="default" />
      <link rel="stylesheet" href="/assets/css/pb-blocks.css" precedence="default" />
      {/* Theme CSS variables from store settings (plan 5.5). */}
      <style dangerouslySetInnerHTML={{ __html: themeToCssVariables(await getThemeSettings(storeId)) }} />
      {/* The draft has no stored stylesheet: compile it live (plan 5.4). */}
      <style dangerouslySetInnerHTML={{ __html: compileDocumentCss(document) }} />
      <div className="pb-render">
        <Render config={serverConfig} data={document} />
      </div>
    </SiteFrame>
  );
}
