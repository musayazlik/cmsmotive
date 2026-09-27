import { prisma } from "@/lib/prisma";
import CatalogForm from "../../_components/catalog-form";

export const dynamic = "force-dynamic";

export default async function NewExtensionPage() {
  const extensionCount = await prisma.extension.count();

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
            appear on the extensions page as roadmap cards. {extensionCount} extension
            {extensionCount === 1 ? "" : "s"} recorded so far.
          </p>
        </div>
        <span className="workspace-index">04 / 05</span>
      </div>

      <CatalogForm endpoint="extensionMedia" api="/api/admin/extensions" redirectTo="/panel/extensions" variant="extension" />
    </>
  );
}
