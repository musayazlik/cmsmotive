import type { PuckComponent } from "@puckeditor/core";
import type { SpacerProps } from "./schema";

export const SpacerRender: PuckComponent<SpacerProps> = ({ size, id }) => (
  <div data-pb={id} className={`pb-spacer pb-spacer--${size}`} aria-hidden="true" />
);
