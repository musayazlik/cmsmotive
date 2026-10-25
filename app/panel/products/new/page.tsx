import { requirePanelUser } from "@/lib/panel-auth";
import ProductForm from "../_components/product-form";
import { productFormOptions } from "../_record";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePanelUser();
  const store = await panelStore();
  const { types, stores } = await productFormOptions();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / PRODUCTS / NEW
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Add a<br />
            <em>new product.</em>
          </h1>
          <p>
            Create the product with a cover, a gallery and a rich description, then add its prices and releases on
            the next screen. It is owned by {store.name} and listed there first.
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <ProductForm types={types} stores={stores} storeId={store.id} />
    </>
  );
}
