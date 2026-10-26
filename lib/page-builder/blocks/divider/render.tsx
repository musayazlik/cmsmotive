import type { PuckComponent } from "@puckeditor/core";
import type { DividerProps } from "./schema";

export const DividerRender: PuckComponent<DividerProps> = ({ variant, spacing, id }) => (
  <div data-pb={id} className={`pb-divider pb-divider--${spacing}`}>
    <hr className={`pb-divider-line pb-divider-line--${variant}`} />
  </div>
);
