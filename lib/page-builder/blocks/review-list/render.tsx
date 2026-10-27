import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { ReviewListProps } from "./schema";

const SAMPLE_REVIEWS = [
  {
    id: "sample-rev-1",
    authorName: "Sarah M.",
    rating: 5,
    body: "Extremely clean TYPO3 implementation. Setup took less than an hour and the template structure is a delight to work with.",
    dateFormatted: "Recent",
    productName: "Enterprise Theme",
  },
  {
    id: "sample-rev-2",
    authorName: "Markus K.",
    rating: 5,
    body: "Saved our agency weeks of frontend development. Fast, accessible and top tier documentation.",
    dateFormatted: "Recent",
    productName: "Commerce Bundle",
  },
  {
    id: "sample-rev-3",
    authorName: "Elena V.",
    rating: 5,
    body: "The headless integration works out of the box with Next.js 16. Highly recommended for enterprise builds.",
    dateFormatted: "Recent",
    productName: "Headless Content Kit",
  },
];

export const ReviewListRender: PuckComponent<ReviewListProps> = ({
  columns = 3,
  id,
  lang,
  ariaLabel,
  _resolvedReviews,
  puck,
}) => {
  // Sample voices only preview the block in the editor; the public page stays
  // empty when the store has no approved reviews.
  const reviews = _resolvedReviews && _resolvedReviews.length > 0 ? _resolvedReviews : puck.isEditing ? SAMPLE_REVIEWS : [];

  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "50px auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
        }}
      >
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="voice-card"
            style={{
              padding: "24px 28px",
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd2d3)",
              borderRadius: "var(--radius, 14px)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ color: "#f5a623", fontSize: "1.1rem", letterSpacing: 2 }}>
              {"★".repeat(rev.rating)}
              {"☆".repeat(Math.max(0, 5 - rev.rating))}
            </div>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--ink-soft, #39444a)", margin: 0, flex: 1 }}>
              &ldquo;{rev.body}&rdquo;
            </p>
            <div style={{ borderTop: "1px solid var(--line-soft, #eef1ee)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted, #5e666d)" }}>
              <strong>{rev.authorName}</strong>
              {rev.productName && <span>{rev.productName}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
