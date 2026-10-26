import { requirePanelUser } from "@/lib/panel-auth";
import { listStorePages } from "@/lib/page-builder/pages";
import { pagePreviewPath } from "@/lib/page-builder/preview-token";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import PagesList from "./_components/pages-list";
import type { LocaleStatus, PageRow } from "./_lib";

export const dynamic = "force-dynamic";

/**
 * The builder pages list (plan 5.6): the home page pinned to the top, one
 * status chip per language, the last editor and the draft preview per
 * locale. Writing happens in _actions.ts; nothing here mutates.
 */
export default async function PagesPage() {
  await requirePanelUser();
  const store = await panelStore();
  const pages = await listStorePages(store.id);

  const editorIds = [...new Set(pages.flatMap((page) => page.locales.map((locale) => locale.updatedById)).filter(Boolean))] as string[];
  const editors = editorIds.length
    ? await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } })
    : [];
  const editorNames = new Map(editors.map((editor) => [editor.id, editor.name]));

  const rows: PageRow[] = pages.map((page) => ({
    id: page.id,
    kind: page.kind,
    slug: page.slug,
    updatedAt: page.updatedAt.toISOString(),
    locales: page.locales.map((locale) => ({
      locale: locale.locale,
      title: locale.title,
      status: locale.status as LocaleStatus,
      version: locale.version,
      publishedAt: locale.publishedAt?.toISOString() ?? null,
      updatedByName: locale.updatedById ? (editorNames.get(locale.updatedById) ?? null) : null,
      previewPath: pagePreviewPath(store.id, page.id, locale.locale),
    })),
  }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / PAGES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Pages built with the <em>visual editor.</em>
          </h1>
          <p>
            Drag-and-drop pages rendered with the site&apos;s own blocks. Draft freely per language, preview the
            result in the real site frame and publish when the accessibility checks pass — unpublishing
            returns the address to the previous site instantly.
          </p>
        </div>
        <span className="workspace-index">PAGES</span>
      </div>

      <PagesList rows={rows} storeLocales={store.locales} defaultLocale={store.defaultLocale} />
    </>
  );
}
