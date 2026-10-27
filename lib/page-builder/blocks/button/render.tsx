import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { ButtonProps } from "./schema";

export const ButtonRender: PuckComponent<ButtonProps> = ({
  text,
  href,
  variant,
  size,
  target = "_self",
  fullWidth,
  id,
  lang,
  ariaLabel,
}) => {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const rel = target === "_blank" || isExternal ? "noopener noreferrer" : undefined;

  return (
    <div
      data-pb={id}
      {...blockAttributes({ id, lang, ariaLabel })}
      className={`pb-button-wrap${fullWidth ? " pb-button-wrap--full" : ""}`}
    >
      <a
        href={href}
        target={target}
        rel={rel}
        className={`pb-button pb-button--${variant} pb-button--${size}${fullWidth ? " pb-button--full" : ""}`}
      >
        {text}
      </a>
    </div>
  );
};
