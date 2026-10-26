import type { Config } from "@puckeditor/core";
import {
  buttonBaseFields,
  containerBaseFields,
  dividerBaseFields,
  gridBaseFields,
  headingBaseFields,
  iconBaseFields,
  imageBaseFields,
  listBaseFields,
  sectionBaseFields,
  spacerBaseFields,
  stackBaseFields,
  textBaseFields,
  videoBaseFields,
} from "./fields.server";
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
 * Server config for `<Render>` on the public page (plan 5.16). Field
 * declarations match the editor's (same base fields — see fields.server.ts),
 * same render functions — but NO editor runtime: importing any "use client"
 * module here would put the interactive @puckeditor/core bundle onto public
 * routes (Faz 0 item 4).
 *
 * Typed as the bare `Config` on purpose: Puck's `Render`/`Puck` require a
 * config assignable to their unparameterized `Config` constraint, which the
 * fully generic maps are not (this compiled in Faz 0).
 */

export const serverConfig: Config = {
  components: {
    ContainerBlock: { label: "Container", fields: { ...containerBaseFields }, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { label: "Grid", fields: { ...gridBaseFields }, defaultProps: { ...gridDefaultProps }, render: GridRender },
    SectionBlock: { label: "Section", fields: { ...sectionBaseFields }, defaultProps: { ...sectionDefaultProps }, render: SectionRender },
    StackBlock: { label: "Stack", fields: { ...stackBaseFields }, defaultProps: { ...stackDefaultProps }, render: StackRender },
    SpacerBlock: { label: "Spacer", fields: { ...spacerBaseFields }, defaultProps: { ...spacerDefaultProps }, render: SpacerRender },
    DividerBlock: { label: "Divider", fields: { ...dividerBaseFields }, defaultProps: { ...dividerDefaultProps }, render: DividerRender },
    HeadingBlock: { label: "Heading", fields: { ...headingBaseFields }, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { label: "Text", fields: { ...textBaseFields }, defaultProps: { ...textDefaultProps }, render: TextRender },
    ButtonBlock: { label: "Button", fields: { ...buttonBaseFields }, defaultProps: { ...buttonDefaultProps }, render: ButtonRender },
    ImageBlock: { label: "Image", fields: { ...imageBaseFields }, defaultProps: { ...imageDefaultProps }, render: ImageRender },
    VideoBlock: { label: "Video", fields: { ...videoBaseFields }, defaultProps: { ...videoDefaultProps }, render: VideoRender },
    IconBlock: { label: "Icon", fields: { ...iconBaseFields }, defaultProps: { ...iconDefaultProps }, render: IconRender },
    ListBlock: { label: "List", fields: { ...listBaseFields }, defaultProps: { ...listDefaultProps }, render: ListRender },
  },
};
