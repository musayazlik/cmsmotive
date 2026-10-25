import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import TypeManager from "./_components/type-manager";

export const dynamic = "force-dynamic";

export default async function ProductTypesPage() {
  await requirePanelUser();
  const types = await prisma.productType.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / PRODUCTS / TYPES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Kinds of <em>product.</em>
          </h1>
          <p>
            A product type is a kind of product — theme, extension, starter kit — with its own listing page and
            catalogue filters. Types are shared by every store of this installation; the key is the handle used in
            URL filters and catalogue markers.
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <TypeManager
        types={types.map((type) => ({
          id: type.id,
          key: type.key,
          name: type.name,
          pluralName: type.pluralName,
          description: type.description,
          listPath: type.listPath,
          position: type.position,
          products: type._count.products,
          createdAt: type.createdAt.toISOString(),
          updatedAt: type.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
