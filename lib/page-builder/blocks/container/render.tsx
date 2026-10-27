import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { ContainerProps } from "./schema";

/** Container (plan 5.2): the page's width bearer block. */
export const ContainerRender: PuckComponent<ContainerProps> = ({ width, children: Children, id, lang, ariaLabel }) => (
  <div data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className={`pb-container pb-container--${width}`}>
    <Children />
  </div>
);
