import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const SPACER_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
export type SpacerSize = (typeof SPACER_SIZES)[number];

export const SPACER_SIZE_LABELS: Record<SpacerSize, string> = {
  xs: "Extra Small (8px)",
  sm: "Small (16px)",
  md: "Medium (32px)",
  lg: "Large (48px)",
  xl: "Extra Large (64px)",
  "2xl": "2X Large (96px)",
};

export const spacerDefaultProps = {
  size: "md",
} as const;

export type SpacerProps = AdvancedBlockProps & {
  id?: string;
  size: SpacerSize;
  style?: BlockStyle;
};

export const spacerPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  size: z.enum(SPACER_SIZES),
  style: blockStyleSchema.optional(),
});
