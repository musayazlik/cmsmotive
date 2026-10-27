import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { heroDefaultProps, type HeroProps } from "./schema";

export const HeroRender: PuckComponent<HeroProps> = ({
  kicker = heroDefaultProps.kicker,
  title = heroDefaultProps.title,
  subtitle = heroDefaultProps.subtitle,
  primaryButtonText = heroDefaultProps.primaryButtonText,
  primaryButtonHref = heroDefaultProps.primaryButtonHref,
  secondaryButtonText = heroDefaultProps.secondaryButtonText,
  secondaryButtonHref = heroDefaultProps.secondaryButtonHref,
  imageUrl,
  align = "left",
  id,
  lang,
  ariaLabel,
}) => {
  const isCentered = align === "center";

  return (
    <section
      data-pb={id}
      {...blockAttributes({ id, lang, ariaLabel })}
      className="pb-hero-section container"
      style={{
        padding: "60px 0 80px",
      }}
    >
      <div
        style={{
          display: isCentered || !imageUrl ? "block" : "grid",
          gridTemplateColumns: isCentered || !imageUrl ? "1fr" : "1.2fr 0.8fr",
          gap: 48,
          alignItems: "center",
          textAlign: isCentered ? "center" : "left",
          maxWidth: isCentered ? 840 : "none",
          margin: isCentered ? "0 auto" : "0",
        }}
      >
        <div>
          {kicker && (
            <span
              style={{
                display: "inline-block",
                color: "var(--indigo, #4353e8)",
                fontSize: "0.85rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              {kicker}
            </span>
          )}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.04em",
              marginBottom: 20,
              color: "var(--ink, #101418)",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "1.2rem",
                lineHeight: 1.6,
                color: "var(--ink-soft, #39444a)",
                marginBottom: 32,
                maxWidth: isCentered ? 680 : "none",
                margin: isCentered ? "0 auto 32px" : "0 0 32px",
              }}
            >
              {subtitle}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              justifyContent: isCentered ? "center" : "flex-start",
            }}
          >
            {primaryButtonText && (
              <a
                href={primaryButtonHref || "#"}
                className="pb-button pb-button--primary pb-button--lg"
                style={{
                  display: "inline-block",
                  padding: "12px 28px",
                  borderRadius: "var(--radius, 14px)",
                  background: "var(--indigo, #4353e8)",
                  color: "#fff",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {primaryButtonText}
              </a>
            )}
            {secondaryButtonText && (
              <a
                href={secondaryButtonHref || "#"}
                className="pb-button pb-button--outline pb-button--lg"
                style={{
                  display: "inline-block",
                  padding: "12px 28px",
                  borderRadius: "var(--radius, 14px)",
                  background: "transparent",
                  color: "var(--ink, #101418)",
                  border: "1px solid var(--line-strong, #cbd2d3)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {secondaryButtonText}
              </a>
            )}
          </div>
        </div>

        {!isCentered && imageUrl && (
          <div style={{ borderRadius: "var(--radius, 14px)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
            <img src={imageUrl} alt={title} style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
          </div>
        )}
      </div>
    </section>
  );
};
