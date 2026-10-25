import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import CatalogForm from "../../_components/catalog-form";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function NewExtensionPage() {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const extensionCount = await prisma.extension.count({ where: { storeId } });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / EXTENSIONS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Add a new<br />
            <em>extension.</em>
          </h1>
          <p>
            Extensions follow the same shape as themes: a cover image, an optional gallery and a rich description. They
            appear as cards on the home page and the extensions page. {extensionCount} extension
            {extensionCount === 1 ? "" : "s"} recorded so far.
          </p>
        </div>
        <span className="workspace-index">04 / 05</span>
      </div>

      <CatalogForm variant="extension" />
    </>
  );
}
