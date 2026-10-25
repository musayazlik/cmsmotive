import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { panelStore } from "@/lib/panel-store";
import NewProductForm from "../_components/new-product-form";
import { productTypeOptions } from "../_record";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePanelUser();
  const store = await panelStore();
  const types = await productTypeOptions();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / <Link href="/panel/products">PRODUCTS</Link> / NEW
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Add a<br />
            <em>new product.</em>
          </h1>
          <p>
            Start with the basics; the product opens as a draft in {store.name}. Then fill in General, add Prices,
            upload the Package and publish once the checklist is complete.
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <NewProductForm types={types} />
    </>
  );
}
