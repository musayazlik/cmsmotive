import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { logoCloudDefaultProps, type LogoCloudProps } from "./schema";

export const LogoCloudRender: PuckComponent<LogoCloudProps> = ({
  title = logoCloudDefaultProps.title,
  logos = logoCloudDefaultProps.logos as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "40px auto", textAlign: "center" }}>
      {title && (
        <p style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted, #5e666d)", fontWeight: 600, marginBottom: 28 }}>
          {title}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 36,
          filter: "grayscale(100%)",
          opacity: 0.75,
        }}
      >
        {logos.map((logo: any, i: number) => {
          const content = logo.image ? (
            <img src={logo.image} alt={logo.name} style={{ maxHeight: 36, maxWidth: 120, objectFit: "contain" }} loading="lazy" />
          ) : (
            <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink, #101418)" }}>
              {logo.name}
            </span>
          );

          return logo.href ? (
            <a key={i} href={logo.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
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
