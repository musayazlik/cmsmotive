import CatalogList from "../_components/catalog-list";

export const dynamic = "force-dynamic";

export default async function ExtensionsPage() {

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / EXTENSIONS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Extensions on
                the roadmap.
          </h1>
          <p>Every extension record in the database, with its cover, gallery size and status. Create a new one to add a cover image, a gallery and a rich description.</p>
        </div>
        <span className="workspace-index">04 / 05</span>
      </div>

      <CatalogList
        api="/api/admin/extensions"
        resourceKey="extensions"
        variant="extension"
        endpoint="extensionMedia"
        createHref="/panel/extensions/new"
        createLabel="New extension"
        emptyText="No extensions yet."
      />
    </>
  );
}
