import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { pricingTableDefaultProps, type PricingTableProps } from "./schema";

export const PricingTableRender: PuckComponent<PricingTableProps> = ({
  title = pricingTableDefaultProps.title,
  subtitle = pricingTableDefaultProps.subtitle,
  plans = pricingTableDefaultProps.plans as any,
  id,
  lang,
  ariaLabel,
  _resolvedPrices,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      {(title || subtitle) && (
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 40px" }}>
          {title && <h2 style={{ fontSize: "2.4rem", marginBottom: 12 }}>{title}</h2>}
          {subtitle && <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "1.05rem" }}>{subtitle}</p>}
        </div>
      )}

      <div className="price-grid">
        {plans.map((plan: any, i: number) => {
          const displayPrice = (plan.productSlug && _resolvedPrices?.[plan.productSlug]) || plan.price;

          return (
            <div key={i} className={`price-card${plan.featured ? " featured" : ""}`}>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="price">
                {displayPrice}
                {plan.period && <small>{plan.period}</small>}
              </div>
              <ul>
                {plan.features?.map((feat: string, fi: number) => (
                  <li key={fi}>{feat}</li>
                ))}
              </ul>
              {/* An empty label renders no anchor: a blank link is an accessibility blocker (plan 5.11). */}
              {plan.ctaLabel ? (
                <a
                  href={plan.ctaHref || "#"}
                  className={`btn pb-button ${plan.featured ? "pb-button--primary" : "pb-button--outline"} pb-button--md`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "10px 18px",
                    borderRadius: "var(--radius, 14px)",
                    fontWeight: 600,
                    textDecoration: "none",
                    marginTop: "auto",
                    background: plan.featured ? "var(--indigo, #4353e8)" : "transparent",
                    color: plan.featured ? "#fff" : "var(--indigo, #4353e8)",
                    border: `1px solid var(--indigo, #4353e8)`,
                  }}
                >
                  {plan.ctaLabel}
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
