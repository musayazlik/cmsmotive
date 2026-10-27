import type { Slot } from "@puckeditor/core";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const STACK_DIRECTIONS = ["vertical", "horizontal"] as const;
export type StackDirection = (typeof STACK_DIRECTIONS)[number];

export const STACK_GAPS = ["none", "xs", "sm", "md", "lg", "xl"] as const;
export type StackGap = (typeof STACK_GAPS)[number];

export const STACK_ALIGNMENTS = ["start", "center", "end", "stretch"] as const;
export type StackAlign = (typeof STACK_ALIGNMENTS)[number];

export const STACK_JUSTIFY = ["start", "center", "end", "between"] as const;
export type StackJustify = (typeof STACK_JUSTIFY)[number];

export const stackDefaultProps = {
  direction: "vertical",
  gap: "md",
  align: "stretch",
  justify: "start",
  wrap: false,
  children: [],
} as const;

export type StackProps = AdvancedBlockProps & {
  id?: string;
  direction: StackDirection;
  gap: StackGap;
  align: StackAlign;
  justify: StackJustify;
  wrap?: boolean;
  children: Slot;
  style?: BlockStyle;
};

export const stackPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  direction: z.enum(STACK_DIRECTIONS),
  gap: z.enum(STACK_GAPS),
  align: z.enum(STACK_ALIGNMENTS),
  justify: z.enum(STACK_JUSTIFY),
  wrap: z.boolean().optional(),
  children: z.array(z.unknown()),
  style: blockStyleSchema.optional(),
});
