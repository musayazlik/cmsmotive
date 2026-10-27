import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { ProductSpotlightProps } from "./schema";

export const ProductSpotlightRender: PuckComponent<ProductSpotlightProps> = ({
  headline,
  description,
  ctaText = "Get Started",
  id,
  lang,
  ariaLabel,
  _resolvedProduct,
  puck,
}) => {
  // If product is missing and not in editor mode, gracefully skip rendering per spec.
  if (!_resolvedProduct && !puck?.isEditing) {
    return <></>;
  }

  const title = _resolvedProduct?.name || headline || "Featured Product";
  const desc = _resolvedProduct?.summary || description;
  const href = _resolvedProduct?.slug ? `/products/${_resolvedProduct.slug}` : "#";

  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "40px auto" }}>
      <div
        className="product-spotlight-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          background: "var(--surface, #fff)",
          border: "1px solid var(--line, #cbd2d3)",
          borderRadius: "var(--radius, 14px)",
          overflow: "hidden",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            minHeight: 280,
            background: "var(--wash-2, #eef0ed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {_resolvedProduct?.coverUrl ? (
            <img
              src={_resolvedProduct.coverUrl}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <div style={{ color: "var(--muted, #5e666d)", fontSize: "1rem", fontWeight: 600 }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {_resolvedProduct?.category && (
            <span className="product-kicker" style={{ color: "var(--indigo, #4353e8)", marginBottom: 8, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {_resolvedProduct.category}
            </span>
          )}
          <h2 style={{ fontSize: "2rem", marginBottom: 12, lineHeight: 1.2 }}>{title}</h2>
          {desc && <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>{desc}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto" }}>
            {_resolvedProduct?.priceFormatted && (
              <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                {_resolvedProduct.priceFormatted}
              </div>
            )}
            <a
              href={href}
              className="pb-button pb-button--primary pb-button--md"
              style={{
                display: "inline-block",
                padding: "10px 22px",
                borderRadius: "var(--radius, 14px)",
                background: "var(--indigo, #4353e8)",
                color: "#fff",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {ctaText} →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
