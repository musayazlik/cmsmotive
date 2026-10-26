import type { Config } from "@puckeditor/core";
import {
  buttonFields,
  containerFields,
  dividerFields,
  gridFields,
  headingFields,
  iconFields,
  imageFields,
  listFields,
  sectionFields,
  spacerFields,
  stackFields,
  textFields,
  videoFields,
} from "./block-fields";
import { containerDefaultProps } from "./blocks/container/schema";
import { gridDefaultProps } from "./blocks/grid/schema";
import { sectionDefaultProps } from "./blocks/section/schema";
import { stackDefaultProps } from "./blocks/stack/schema";
import { spacerDefaultProps } from "./blocks/spacer/schema";
import { dividerDefaultProps } from "./blocks/divider/schema";
import { headingDefaultProps } from "./blocks/heading/schema";
import { textDefaultProps } from "./blocks/text/schema";
import { buttonDefaultProps } from "./blocks/button/schema";
import { imageDefaultProps } from "./blocks/image/schema";
import { videoDefaultProps } from "./blocks/video/schema";
import { iconDefaultProps } from "./blocks/icon/schema";
import { listDefaultProps } from "./blocks/list/schema";
import { ContainerRender } from "./blocks/container/render";
import { GridRender } from "./blocks/grid/render";
import { SectionRender } from "./blocks/section/render";
import { StackRender } from "./blocks/stack/render";
import { SpacerRender } from "./blocks/spacer/render";
import { DividerRender } from "./blocks/divider/render";
import { HeadingRender } from "./blocks/heading/render";
import { TextRender } from "./blocks/text/render";
import { ButtonRender } from "./blocks/button/render";
import { ImageRender } from "./blocks/image/render";
import { VideoRender } from "./blocks/video/render";
import { IconRender } from "./blocks/icon/render";
import { ListRender } from "./blocks/list/render";

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
      components: [
        "ContainerBlock",
        "GridBlock",
        "SectionBlock",
        "StackBlock",
        "SpacerBlock",
        "DividerBlock",
      ],
      defaultExpanded: true,
    },
    content: {
      title: "Content",
      components: [
        "HeadingBlock",
        "TextBlock",
        "ButtonBlock",
        "ImageBlock",
        "VideoBlock",
        "IconBlock",
        "ListBlock",
      ],
      defaultExpanded: true,
    },
  },
  components: {
    ContainerBlock: { label: "Container", fields: containerFields, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { label: "Grid", fields: gridFields, defaultProps: { ...gridDefaultProps }, render: GridRender },
    SectionBlock: { label: "Section", fields: sectionFields, defaultProps: { ...sectionDefaultProps }, render: SectionRender },
    StackBlock: { label: "Stack", fields: stackFields, defaultProps: { ...stackDefaultProps }, render: StackRender },
    SpacerBlock: { label: "Spacer", fields: spacerFields, defaultProps: { ...spacerDefaultProps }, render: SpacerRender },
    DividerBlock: { label: "Divider", fields: dividerFields, defaultProps: { ...dividerDefaultProps }, render: DividerRender },
    HeadingBlock: { label: "Heading", fields: headingFields, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { label: "Text", fields: textFields, defaultProps: { ...textDefaultProps }, render: TextRender },
    ButtonBlock: { label: "Button", fields: buttonFields, defaultProps: { ...buttonDefaultProps }, render: ButtonRender },
    ImageBlock: { label: "Image", fields: imageFields, defaultProps: { ...imageDefaultProps }, render: ImageRender },
    VideoBlock: { label: "Video", fields: videoFields, defaultProps: { ...videoDefaultProps }, render: VideoRender },
    IconBlock: { label: "Icon", fields: iconFields, defaultProps: { ...iconDefaultProps }, render: IconRender },
    ListBlock: { label: "List", fields: listFields, defaultProps: { ...listDefaultProps }, render: ListRender },
  },
};
