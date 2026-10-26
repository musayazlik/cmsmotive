import type { PuckComponent } from "@puckeditor/core";
import type { HeadingProps } from "./schema";

/** Renders `<h1>`–`<h4>`; no hooks, safe on the server and in the canvas. */
export const HeadingRender: PuckComponent<HeadingProps> = ({ text, level, id }) => {
  const Tag = level;
  return (
    <Tag data-pb={id} className="pb-heading">
      {text}
    </Tag>
  );
};
