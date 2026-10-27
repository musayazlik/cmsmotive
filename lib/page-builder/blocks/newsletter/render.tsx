import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { NewsletterForm } from "../../interactive/newsletter-form";
import { newsletterDefaultProps, type NewsletterProps } from "./schema";

export const NewsletterRender: PuckComponent<NewsletterProps> = ({
  kicker = newsletterDefaultProps.kicker,
  title = newsletterDefaultProps.title,
  description = newsletterDefaultProps.description,
  buttonText = newsletterDefaultProps.buttonText,
  privacyNote = newsletterDefaultProps.privacyNote,
  privacyVersion = "1.0",
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      <div
        style={{
          background: "var(--surface, #fff)",
          border: "1px solid var(--line, #cbd2d3)",
          borderRadius: "var(--radius, 14px)",
          padding: "48px 32px",
          textAlign: "center",
          maxWidth: 720,
          margin: "0 auto",
          boxShadow: "var(--shadow)",
        }}
      >
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
        <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>{title}</h2>
        {description && (
          <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "1.05rem", lineHeight: 1.6, marginBottom: 32 }}>
            {description}
          </p>
        )}

        <NewsletterForm
          buttonText={buttonText}
          privacyVersion={privacyVersion}
          privacyNote={privacyNote}
        />
      </div>
    </section>
  );
};
