import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { featureGridDefaultProps, type FeatureGridProps } from "./schema";

export const FeatureGridRender: PuckComponent<FeatureGridProps> = ({
  kicker = featureGridDefaultProps.kicker,
  title = featureGridDefaultProps.title,
  subtitle = featureGridDefaultProps.subtitle,
  columns = 3,
  items = featureGridDefaultProps.items as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      {(kicker || title || subtitle) && (
        <div style={{ textAlign: "center", maxWidth: 740, margin: "0 auto 48px" }}>
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
          {title && <h2 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: 14 }}>{title}</h2>}
          {subtitle && <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "1.1rem", lineHeight: 1.6 }}>{subtitle}</p>}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 24,
        }}
      >
        {items.map((item: any, i: number) => {
          const content = (
            <div
              style={{
                padding: "32px 28px",
                background: "var(--surface, #fff)",
                border: "1px solid var(--line, #cbd2d3)",
                borderRadius: "var(--radius, 14px)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {item.icon && <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>{item.icon}</div>}
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{item.title}</h3>
              <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
                {item.description}
              </p>
            </div>
          );

          return item.href ? (
            <a key={i} href={item.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              {content}
            </a>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </section>
  );
};
