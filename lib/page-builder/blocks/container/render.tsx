import type { PuckComponent } from "@puckeditor/core";
import type { ContainerProps } from "./schema";

/** Container (plan 5.2): the page's width bearer block. */
export const ContainerRender: PuckComponent<ContainerProps> = ({ width, children: Children, id }) => (
  <div data-pb={id} className={`pb-container pb-container--${width}`}>
    <Children />
  </div>
);
