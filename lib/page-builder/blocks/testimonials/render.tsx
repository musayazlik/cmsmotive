import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { testimonialsDefaultProps, type TestimonialsProps } from "./schema";

export const TestimonialsRender: PuckComponent<TestimonialsProps> = ({
  kicker = testimonialsDefaultProps.kicker,
  title = testimonialsDefaultProps.title,
  items = testimonialsDefaultProps.items as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      {(kicker || title) && (
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 40px" }}>
          {kicker && (
            <span
              style={{
                display: "inline-block",
                color: "var(--indigo, #4353e8)",
                fontSize: "0.82rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              {kicker}
            </span>
          )}
          {title && <h2 style={{ fontSize: "2.4rem", fontWeight: 800 }}>{title}</h2>}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(320px, 1fr))`,
          gap: 24,
        }}
      >
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="voice-card"
            style={{
              padding: "32px",
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd2d3)",
              borderRadius: "var(--radius, 14px)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "var(--shadow)",
            }}
          >
            {typeof item.rating === "number" && (
              <div style={{ color: "#f5a623", fontSize: "1.1rem", letterSpacing: 2 }}>
                {"★".repeat(item.rating)}
                {"☆".repeat(Math.max(0, 5 - item.rating))}
              </div>
            )}
            <blockquote style={{ fontSize: "1.05rem", lineHeight: 1.6, color: "var(--ink-soft, #39444a)", margin: 0, flex: 1, fontStyle: "italic" }}>
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "1px solid var(--line-soft, #eef1ee)", paddingTop: 16 }}>
              {item.avatar ? (
                <img src={item.avatar} alt={item.author} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--indigo-soft, #eaedff)",
                    color: "var(--indigo, #4353e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1rem",
                  }}
                >
                  {item.author.charAt(0)}
                </div>
              )}
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--ink, #101418)" }}>{item.author}</strong>
                {(item.role || item.company) && (
                  <span style={{ fontSize: "0.82rem", color: "var(--muted, #5e666d)" }}>
                    {[item.role, item.company].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
