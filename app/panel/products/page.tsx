import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import ProductList from "./_components/product-list";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requirePanelUser();
  // panelStore() only to fail early when no store is selected; types are shared by every store.
  await panelStore();
  const types = await prisma.productType.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { key: true, name: true },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / PRODUCTS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Products in the <em>catalogue.</em>
          </h1>
          <p>
            Everything this store sells, in the order of its pages. Create a draft, then fill in its General,
            Prices and Packages tabs and publish it once the checklist is complete. Types are managed under
            Products → Types.
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <ProductList
        types={types.map((type) => ({ value: type.key, label: type.name }))}
        createHref="/panel/products/new"
        createLabel="New product"
      />
    </>
  );
}
