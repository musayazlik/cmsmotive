import type { PuckComponent } from "@puckeditor/core";
import type { ImageProps } from "./schema";

export const ImageRender: PuckComponent<ImageProps> = ({
  src,
  alt,
  decorative,
  caption,
  width,
  height,
  loading = "lazy",
  fit = "cover",
  rounded = "md",
  id,
}) => {
  if (!src) {
    return (
      <div data-pb={id} className="pb-image pb-image--empty">
        <span className="pb-image-placeholder">No image selected</span>
      </div>
    );
  }

  const imgAlt = decorative ? "" : alt;

  return (
    <figure data-pb={id} className={`pb-image pb-image--rounded-${rounded}`}>
      <img
        src={src}
        alt={imgAlt}
        width={width}
        height={height}
        loading={loading}
        className={`pb-image-el pb-image-el--fit-${fit}`}
      />
      {caption && !decorative ? <figcaption className="pb-image-caption">{caption}</figcaption> : null}
    </figure>
  );
};
