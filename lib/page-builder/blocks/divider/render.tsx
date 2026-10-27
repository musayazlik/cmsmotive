import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { DividerProps } from "./schema";

export const DividerRender: PuckComponent<DividerProps> = ({ variant, spacing, id, lang }) => (
  <div data-pb={id} {...blockAttributes({ id, lang })} className={`pb-divider pb-divider--${spacing}`}>
    <hr className={`pb-divider-line pb-divider-line--${variant}`} />
  </div>
);
