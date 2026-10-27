import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { ctaDefaultProps, type CTAProps } from "./schema";

export const CTARender: PuckComponent<CTAProps> = ({
  title = ctaDefaultProps.title,
  description = ctaDefaultProps.description,
  buttonText = ctaDefaultProps.buttonText,
  buttonHref = ctaDefaultProps.buttonHref,
  secondaryText = ctaDefaultProps.secondaryText,
  secondaryHref = ctaDefaultProps.secondaryHref,
  variant = "brand",
  id,
  lang,
  ariaLabel,
}) => {
  const isDark = variant === "dark";
  const isBrand = variant === "brand";

  const bg = isBrand ? "var(--indigo, #4353e8)" : isDark ? "var(--dark, #12171b)" : "var(--surface, #fff)";
  const color = isBrand || isDark ? "#ffffff" : "var(--ink, #101418)";
  const descColor = isBrand ? "rgba(255,255,255,0.85)" : isDark ? "#adb9bd" : "var(--ink-muted, #55616a)";

  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      <div
        style={{
          background: bg,
          color,
          padding: "60px 40px",
          borderRadius: "var(--radius, 14px)",
          border: isBrand || isDark ? "none" : "1px solid var(--line, #cbd2d3)",
          textAlign: "center",
          maxWidth: 960,
          margin: "0 auto",
          boxShadow: isBrand ? "0 20px 40px rgba(67, 83, 232, 0.2)" : "var(--shadow)",
        }}
      >
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
          {title}
        </h2>
        {description && (
          <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: descColor, maxWidth: 640, margin: "0 auto 36px" }}>
            {description}
          </p>
        )}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href={buttonHref}
            className="pb-button pb-button--primary pb-button--lg"
            style={{
              padding: "12px 28px",
              borderRadius: "var(--radius, 14px)",
              background: isBrand ? "#ffffff" : "var(--indigo, #4353e8)",
              color: isBrand ? "var(--indigo, #4353e8)" : "#ffffff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {buttonText}
          </a>
          {secondaryText && secondaryHref && (
            <a
              href={secondaryHref}
              className="pb-button pb-button--outline pb-button--lg"
              style={{
                padding: "12px 28px",
                borderRadius: "var(--radius, 14px)",
                background: "transparent",
                color: isBrand || isDark ? "#ffffff" : "var(--ink, #101418)",
                border: `1px solid ${isBrand || isDark ? "rgba(255,255,255,0.4)" : "var(--line-strong, #cbd2d3)"}`,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};
