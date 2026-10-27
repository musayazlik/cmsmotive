import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { ProductFilter } from "../../interactive/product-filter";
import type { ProductGridProps } from "./schema";

const SAMPLE_PRODUCTS = [
  {
    id: "sample-1",
    slug: "sample-product-1",
    name: "Enterprise TYPO3 Theme",
    summary: "Clean, accessible and modular theme designed for enterprise businesses.",
    category: "Corporate",
    badge: "Popular",
    priceFormatted: "€149",
    coverUrl: null,
  },
  {
    id: "sample-2",
    slug: "sample-product-2",
    name: "Headless Content Kit",
    summary: "Modern React & Next.js frontend kit connecting directly to TYPO3 APIs.",
    category: "Agency",
    badge: "New",
    priceFormatted: "€99",
    coverUrl: null,
  },
  {
    id: "sample-3",
    slug: "sample-product-3",
    name: "Commerce Extension Bundle",
    summary: "Full-featured shopping cart, checkout and invoice generator extension.",
    category: "E-Commerce",
    badge: null,
    priceFormatted: "€199",
    coverUrl: null,
  },
];

export const ProductGridRender: PuckComponent<ProductGridProps> = ({
  category = "",
  columns = 3,
  showFilter = true,
  showPrice = true,
  id,
  lang,
  ariaLabel,
  _resolvedProducts,
  puck,
}) => {
  // Sample cards only exist to preview the block in the editor; the public
  // page shows an empty grid when the store has no matching products.
  const products = _resolvedProducts && _resolvedProducts.length > 0 ? _resolvedProducts : puck.isEditing ? SAMPLE_PRODUCTS : [];
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  const gridElementId = `pg-${id || "grid"}`;

  return (
    <div data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="pb-product-grid-section container">
      {showFilter && categories.length > 1 && (
        <ProductFilter categories={categories} targetGridId={gridElementId} />
      )}
      <div
        id={gridElementId}
        className="product-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 16,
        }}
      >
        {products.map((prod) => (
          <article
            key={prod.id}
            className="product-card"
            data-product-category={prod.category || ""}
          >
            <div className="product-visual">
              {prod.coverUrl ? (
                <img src={prod.coverUrl} alt={prod.name} loading="lazy" />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "var(--wash-2, #eef0ed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted, #5e666d)",
                    fontSize: "0.85rem",
                  }}
                >
                  {prod.name}
                </div>
              )}
              {prod.badge && <span className="visual-label">{prod.badge}</span>}
            </div>
            <div className="product-body">
              {prod.category && <span className="product-kicker">{prod.category}</span>}
              <h3>{prod.name}</h3>
              <p>{prod.summary}</p>
              <div className="product-bottom">
                {showPrice && prod.priceFormatted ? (
                  <div className="product-price">
                    {prod.priceFormatted}
                    <small>One-time licence</small>
                  </div>
                ) : <span />}
                <a href={`/products/${prod.slug}`} className="text-link">
                  View details →
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
