import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

export const ICON_NAMES = [
  "check",
  "star",
  "shield",
  "sparkles",
  "zap",
  "heart",
  "globe",
  "lock",
  "mail",
  "phone",
  "arrow-right",
  "info",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_SIZES = ["sm", "md", "lg", "xl"] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const iconDefaultProps = {
  name: "check",
  size: "md",
} as const;

export type IconProps = {
  id?: string;
  name: IconName;
  size: IconSize;
  style?: BlockStyle;
};

export const iconPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  name: z.enum(ICON_NAMES),
  size: z.enum(ICON_SIZES),
  style: blockStyleSchema.optional(),
});
