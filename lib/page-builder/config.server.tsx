import type { Config } from "@puckeditor/core";
import { containerBaseFields, gridBaseFields, headingBaseFields, textBaseFields } from "./fields.server";
import { containerDefaultProps } from "./blocks/container/schema";
import { gridDefaultProps } from "./blocks/grid/schema";
import { headingDefaultProps } from "./blocks/heading/schema";
import { textDefaultProps } from "./blocks/text/schema";
import { ContainerRender } from "./blocks/container/render";
import { GridRender } from "./blocks/grid/render";
import { HeadingRender } from "./blocks/heading/render";
import { TextRender } from "./blocks/text/render";
/**
 * Server config for `<Render>` on the public page (plan 5.16). Field
 * declarations match the editor's (same base fields — see fields.server.ts),
 * same render functions — but NO editor runtime: importing any "use client"
 * module here would put the interactive @puckeditor/core bundle onto public
 * routes (Faz 0 item 4).
 *
 * Typed as the bare `Config` on purpose: Puck's `Render`/`Puck` require a
 * config assignable to their unparameterized `Config` constraint, which the
 * fully generic `Config<UserBlocks>` is not. Block-level type safety lives in
 * each render (`PuckComponent<...Props>`) and in validate.ts's zod schemas.
 */

export const serverConfig: Config = {
  components: {
    ContainerBlock: { fields: containerBaseFields, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { fields: gridBaseFields, defaultProps: { ...gridDefaultProps }, render: GridRender },
    HeadingBlock: { fields: headingBaseFields, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { fields: textBaseFields, defaultProps: { ...textDefaultProps }, render: TextRender },
  },
};
