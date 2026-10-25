import { requirePanelUser } from "@/lib/panel-auth";
import ChangelogList from "./_components/changelog-list";
import { productOptions } from "./_products";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

/** `?product=<id>` (linked from a product's edit page) opens the list filtered to that product. */
export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const [{ product }, products] = await Promise.all([searchParams, productOptions(storeId)]);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / CHANGELOG
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Every release, <em>on record.</em>
          </h1>
          <p>
            Release notes for the catalogue&apos;s products, the most recently added first. Each entry belongs to one
            product and shows up in the Changelog tab of its detail page, newest release on top.
          </p>
        </div>
        <span className="workspace-index">CHANGELOG</span>
      </div>

      <ChangelogList products={products} initialProduct={product ?? ""} />
    </>
  );
}
