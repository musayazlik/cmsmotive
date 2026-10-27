import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const DIVIDER_VARIANTS = ["solid", "dashed", "dotted"] as const;
export type DividerVariant = (typeof DIVIDER_VARIANTS)[number];

export const DIVIDER_SPACINGS = ["sm", "md", "lg"] as const;
export type DividerSpacing = (typeof DIVIDER_SPACINGS)[number];

export const dividerDefaultProps = {
  variant: "solid",
  spacing: "md",
} as const;

export type DividerProps = AdvancedBlockProps & {
  id?: string;
  variant: DividerVariant;
  spacing: DividerSpacing;
  style?: BlockStyle;
};

export const dividerPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  variant: z.enum(DIVIDER_VARIANTS),
  spacing: z.enum(DIVIDER_SPACINGS),
  style: blockStyleSchema.optional(),
});
