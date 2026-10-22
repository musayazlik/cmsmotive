import { requirePanelUser } from "@/lib/panel-auth";
import { notFound } from "next/navigation";
import CatalogForm from "../../_components/catalog-form";
import { loadExtension } from "../../_components/catalog-record";

export const dynamic = "force-dynamic";

export default async function EditExtensionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const { id } = await params;
  const extension = await loadExtension(id);
  if (!extension) notFound();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / EXTENSIONS / EDIT
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Edit <em>{extension.name}.</em>
          </h1>
          <p>Update the card copy, description, cover and gallery. Changes show on the home page and /extensions as soon as you save.</p>
        </div>
        <span className="workspace-index">04 / 05</span>
      </div>

      <CatalogForm variant="extension" record={extension} />
    </>
  );
}
