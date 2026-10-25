import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import CatalogForm from "../../_components/catalog-form";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function NewThemePage() {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const themeCount = await prisma.theme.count({ where: { storeId } });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / THEMES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Add a<br />
            <em>new theme.</em>
          </h1>
          <p>
            Create a theme record with a cover image, a gallery and a rich description. The description is stored as
            HTML and rendered wherever the theme appears on the site. {themeCount} theme{themeCount === 1 ? "" : "s"}{" "}
            exist so far.
          </p>
        </div>
        <span className="workspace-index">03 / 05</span>
      </div>

      <CatalogForm variant="theme" />
    </>
  );
}
