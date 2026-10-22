import { requirePanelUser } from "@/lib/panel-auth";
import ChangelogForm from "../_components/changelog-form";
import { productOptions } from "../_products";

export const dynamic = "force-dynamic";

export default async function NewChangelogEntryPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePanelUser();
  const [{ product }, products] = await Promise.all([searchParams, productOptions()]);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / CHANGELOG / NEW
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Add a <em>release note.</em>
          </h1>
          <p>Choose the theme or extension first, then describe what changed. Each line gets a New, Improved or Fixed tag.</p>
        </div>
        <span className="workspace-index">CHANGELOG</span>
      </div>

      <ChangelogForm products={products} initialProduct={product ?? ""} />
    </>
  );
}
