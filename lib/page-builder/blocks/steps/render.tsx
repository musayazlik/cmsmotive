import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { stepsDefaultProps, type StepsProps } from "./schema";

export const StepsRender: PuckComponent<StepsProps> = ({
  kicker = stepsDefaultProps.kicker,
  title = stepsDefaultProps.title,
  steps = stepsDefaultProps.steps as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      {(kicker || title) && (
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
          {title && <h2 style={{ fontSize: "2.4rem", fontWeight: 800 }}>{title}</h2>}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
          gap: 24,
        }}
      >
        {steps.map((step: any, i: number) => (
          <div
            key={i}
            style={{
              padding: "32px 28px",
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd2d3)",
              borderRadius: "var(--radius, 14px)",
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "var(--indigo, #4353e8)",
                marginBottom: 12,
                opacity: 0.85,
              }}
            >
              {step.stepNumber}
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>{step.title}</h3>
            <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
