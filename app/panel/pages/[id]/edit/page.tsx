import { notFound } from "next/navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { ensurePageLocale, listRevisions, loadPageLocale } from "@/lib/page-builder/pages";
import { pagePreviewPath } from "@/lib/page-builder/preview-token";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n/config";
import type { Data } from "@puckeditor/core";
import { getThemeSettings } from "@/lib/settings";
import { themeToCssVariables } from "@/lib/page-builder/theme";
import { prepareDocument } from "@/lib/page-builder/document";
import PageEditor from "../../_components/page-editor";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string }>;
};

/**
 * The fullscreen editor for one page language (plan 5.6). PanelShell renders
 * bare for this path (…/pages/[id]/edit), so Puck fills the window while the
 * route stays behind the panel guard. Opening a language the page does not
 * have yet creates an empty version, seeded with the page's existing title.
 */
export default async function EditPage({ params, searchParams }: Props) {
  const panelUser = await requirePanelUser();
  const store = await panelStore();
  const { id } = await params;
  const { locale: localeParam } = await searchParams;
  const locale = isLocale(localeParam) && store.locales.includes(localeParam) ? localeParam : store.defaultLocale;

  let loaded = await loadPageLocale(store.id, id, locale);
  if (!loaded) notFound();
  if (!loaded.locale) {
    const fallbackTitle =
      (await prisma.pageLocale.findFirst({
        where: { pageId: id },
        orderBy: { id: "asc" },
        select: { title: true },
      }))?.title ?? loaded.page.slug;
    const created = await ensurePageLocale(store.id, id, locale, fallbackTitle || "Untitled page", panelUser.id);
    if ("error" in created) {
      loaded = await loadPageLocale(store.id, id, locale);
      if (!loaded?.locale) notFound();
    } else {
      loaded = await loadPageLocale(store.id, id, locale);
      if (!loaded?.locale) notFound();
    }
  }
  const row = loaded.locale;
  const document = prepareDocument(row.draft);
  if (!document.ok) throw new Error(`This page could not be opened: ${document.error}`);

  const revisions = await listRevisions(store.id, id, locale);
  const theme = await getThemeSettings(store.id);

  return (
    <PageEditor
      pageId={id}
      locale={locale}
      storeLocales={store.locales}
      pageSlug={loaded.page.slug}
      kind={loaded.page.kind}
      title={row.title}
      key={`${id}:${locale}`}
      initialData={document.data as Data}
      initialVersion={row.version}
      previewPath={pagePreviewPath(store.id, id, locale)}
      themeCss={themeToCssVariables(theme)}
      status={row.status}
      publishAt={row.publishAt ? row.publishAt.toISOString() : null}
      seo={{
        title: row.title,
        seoTitle: row.seoTitle ?? "",
        seoDescription: row.seoDescription ?? "",
        noindex: row.noindex,
      }}
      revisions={revisions.map((revision) => ({
        id: revision.id,
        note: revision.note,
        createdAt: revision.createdAt.toISOString(),
      }))}
    />
  );
}
