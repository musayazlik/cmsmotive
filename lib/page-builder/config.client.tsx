import type { Config } from "@puckeditor/core";
import { containerFields, gridFields, headingFields, textFields } from "./block-fields";
import { containerDefaultProps } from "./blocks/container/schema";
import { gridDefaultProps } from "./blocks/grid/schema";
import { headingDefaultProps } from "./blocks/heading/schema";
import { textDefaultProps } from "./blocks/text/schema";
import { ContainerRender } from "./blocks/container/render";
import { GridRender } from "./blocks/grid/render";
import { HeadingRender } from "./blocks/heading/render";
import { TextRender } from "./blocks/text/render";

/**
 * Client config for `<Puck>` (plan 5.16). Only the editor imports this file;
 * public routes import config.server.tsx so @puckeditor/core's interactive
 * runtime never reaches the public bundle (Faz 0 acceptance item 4).
 *
 * Field declarations are shared with the server config: the plain fields come
 * from fields.server.ts and block-fields.tsx only adds the interactive
 * StyleField, so `use client`-free server routes can never pull the editor
 * runtime (Faz 0 item 4).
 * Typed as the bare `Config` so it satisfies Puck's `Config` constraint —
 * block-level types live in the renders (`PuckComponent<...Props>`) and in
 * validate.ts. The categories feed the left drawer; labels surface the item chrome.
 */

export const clientConfig: Config = {
  categories: {
    layout: {
      title: "Layout",
      components: ["ContainerBlock", "GridBlock"],
      defaultExpanded: true,
    },
    content: {
      title: "Content",
      components: ["HeadingBlock", "TextBlock"],
      defaultExpanded: true,
    },
  },
  components: {
    ContainerBlock: { label: "Container", fields: containerFields, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { label: "Grid", fields: gridFields, defaultProps: { ...gridDefaultProps }, render: GridRender },
    HeadingBlock: { label: "Heading", fields: headingFields, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { label: "Text", fields: textFields, defaultProps: { ...textDefaultProps }, render: TextRender },
  },
};
