import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { type GridProps, type GridVariant } from "./schema";

/**
 * Grid (plan 5.2). Layout values (`grid-template-columns`, gap) live in the
 * scoped stylesheet the compiler emits for this block; the render only gives
 * the wrapper stable class names so public/assets/css/pb-blocks.css can add
 * fallback stacking (tablet collapses 4 columns, mobile stacks everything).
 */
export const GridRender: PuckComponent<GridProps> = ({ variant, col1, col2, col3, col4, id, lang, ariaLabel }) => {
  const Col1 = col1;
  const Col2 = col2;
  const Col3 = col3;
  const Col4 = col4;
  return (
    <div data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className={`pb-grid ${gridVariantClass(variant)}`}>
      <Col1 />
      <Col2 />
      <Col3 />
      <Col4 />
    </div>
  );
};

/** Variant values ("1/3+2/3") are not CSS-class-safe; fold them to alphanumerics. */
export function gridVariantClass(variant: GridVariant): string {
  return `pb-grid--${variant.replace(/[^a-z0-9]+/gi, "-")}`;
}
