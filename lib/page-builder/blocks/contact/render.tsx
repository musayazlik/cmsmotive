import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { ContactForm } from "../../interactive/contact-form";
import { contactDefaultProps, type ContactProps } from "./schema";

export const ContactRender: PuckComponent<ContactProps> = ({
  title = contactDefaultProps.title,
  description = contactDefaultProps.description,
  submitText = contactDefaultProps.submitText,
  showOffice = true,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "60px auto" }}>
      <div
        className="contact-grid"
        style={{
          display: "grid",
          gridTemplateColumns: showOffice ? "1.2fr 0.8fr" : "1fr",
          gap: 40,
        }}
      >
        <div
          className="contact-card"
          style={{
            padding: "40px",
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #cbd2d3)",
            borderRadius: "var(--radius, 14px)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 12 }}>{title}</h2>
          {description && (
            <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 32 }}>
              {description}
            </p>
          )}

          <ContactForm submitText={submitText} />
        </div>

        {showOffice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              className="contact-card"
              style={{
                padding: "32px",
                background: "var(--surface, #fff)",
                border: "1px solid var(--line, #cbd2d3)",
                borderRadius: "var(--radius, 14px)",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Direct Inquiries</h3>
              <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                For security assessments, custom licensing contracts or enterprise procurement questions.
              </p>
              <div style={{ marginTop: 16, fontWeight: 700, color: "var(--indigo, #4353e8)" }}>
                support@cmsmotive.com
              </div>
            </div>

            <div
              className="contact-card"
              style={{
                padding: "32px",
                background: "var(--surface, #fff)",
                border: "1px solid var(--line, #cbd2d3)",
                borderRadius: "var(--radius, 14px)",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Engineering SLA</h3>
              <p style={{ color: "var(--ink-muted, #55616a)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                Active subscribers receive priority ticket resolution with direct response from our core developers.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
