import { requirePanelUser } from "@/lib/panel-auth";
import { notFound } from "next/navigation";
import CatalogForm from "../../_components/catalog-form";
import { loadTheme } from "../../_components/catalog-record";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const { id } = await params;
  const theme = await loadTheme(storeId, id);
  if (!theme) notFound();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / THEMES / EDIT
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Edit <em>{theme.name}.</em>
          </h1>
          <p>Update the card copy, description, cover and gallery. Changes show on the home page and /themes as soon as you save.</p>
        </div>
        <span className="workspace-index">03 / 05</span>
      </div>

      <CatalogForm variant="theme" record={theme} />
    </>
  );
}
