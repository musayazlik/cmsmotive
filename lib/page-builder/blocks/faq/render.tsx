import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { faqDefaultProps, type FAQProps } from "./schema";

export const FAQRender: PuckComponent<FAQProps> = ({
  kicker = faqDefaultProps.kicker,
  title = faqDefaultProps.title,
  subtitle = faqDefaultProps.subtitle,
  items = faqDefaultProps.items as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto", maxWidth: 840 }}>
      {(kicker || title || subtitle) && (
        <div style={{ textAlign: "center", marginBottom: 40 }}>
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
          {title && <h2 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: 12 }}>{title}</h2>}
          {subtitle && <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "1.05rem" }}>{subtitle}</p>}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item: any, i: number) => (
          <details
            key={i}
            style={{
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd2d3)",
              borderRadius: "var(--radius, 14px)",
              padding: "18px 24px",
              cursor: "pointer",
            }}
          >
            <summary
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--ink, #101418)",
                outline: "none",
                userSelect: "none",
              }}
            >
              {item.question}
            </summary>
            <p
              style={{
                marginTop: 14,
                marginBottom: 4,
                fontSize: "0.95rem",
                lineHeight: 1.65,
                color: "var(--ink-soft, #39444a)",
              }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
};
