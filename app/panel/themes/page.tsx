import CatalogList from "../_components/catalog-list";

export const dynamic = "force-dynamic";

export default async function ThemesPage() {

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / THEMES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Themes in the
                <em>catalogue.</em>
          </h1>
          <p>Every theme record in the database, with its cover, gallery size and status. Create a new one to add a cover image, a gallery and a rich description.</p>
        </div>
        <span className="workspace-index">03 / 05</span>
      </div>

      <CatalogList
        api="/api/admin/themes"
        resourceKey="themes"
        variant="theme"
        endpoint="themeMedia"
        createHref="/panel/themes/new"
        createLabel="New theme"
        emptyText="No themes yet."
      />
    </>
  );
}
