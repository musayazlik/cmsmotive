import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { SpacerProps } from "./schema";

export const SpacerRender: PuckComponent<SpacerProps> = ({ size, id, lang }) => (
  <div data-pb={id} {...blockAttributes({ id, lang })} className={`pb-spacer pb-spacer--${size}`} aria-hidden="true" />
);
