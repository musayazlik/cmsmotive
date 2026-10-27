import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { StackProps } from "./schema";

export const StackRender: PuckComponent<StackProps> = ({
  direction,
  gap,
  align,
  justify,
  wrap,
  children: Children,
  id,
  lang,
  ariaLabel,
}) => (
  <div
    data-pb={id}
    {...blockAttributes({ id, lang, ariaLabel })}
    className={`pb-stack pb-stack--${direction} pb-stack--gap-${gap} pb-stack--align-${align} pb-stack--justify-${justify}${wrap ? " pb-stack--wrap" : ""}`}
  >
    <Children />
  </div>
);
