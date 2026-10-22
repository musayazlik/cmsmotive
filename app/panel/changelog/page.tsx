import { requirePanelUser } from "@/lib/panel-auth";
import ChangelogList from "./_components/changelog-list";
import { productOptions } from "./_products";

export const dynamic = "force-dynamic";

/** `?product=theme:<id>` (linked from a theme's edit page) opens the list filtered to that product. */
export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePanelUser();
  const [{ product }, products] = await Promise.all([searchParams, productOptions()]);

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
            Release notes for themes and extensions, the most recently added first. Each entry belongs to one
            product and shows up in the Changelog tab of its detail page, newest release on top.
          </p>
        </div>
        <span className="workspace-index">CHANGELOG</span>
      </div>

      <ChangelogList products={products} initialProduct={product ?? ""} />
    </>
  );
}
