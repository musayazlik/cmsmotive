import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { SectionProps } from "./schema";

export const SectionRender: PuckComponent<SectionProps> = ({
  variant,
  image,
  overlayOpacity = 50,
  children: Children,
  id,
  lang,
  ariaLabel,
}) => (
  <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className={`pb-section pb-section--${variant}`}>
    {variant === "image" && image ? (
      <div className="pb-section-backdrop" aria-hidden="true">
        <img src={image} alt="" className="pb-section-img" loading="lazy" />
        <div
          className="pb-section-overlay"
          style={{ opacity: Math.min(1, Math.max(0, overlayOpacity / 100)) }}
        />
      </div>
    ) : null}
    <div className="pb-section-content">
      <Children />
    </div>
  </section>
);
