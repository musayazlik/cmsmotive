import type { Slot } from "@puckeditor/core";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

/**
 * Grid (plan 5.2): one column layout per slot pair. All four slots stay
 * declared so a variant switch never strands content in a hidden slot; the
 * CSS template simply ignores/clips overflowing columns, and the mobile
 * breakpoint stacks everything (public/assets/css/pb-blocks.css).
 */

export const GRID_VARIANTS = ["2", "3", "4", "1/3+2/3", "2/3+1/3", "1/4+3/4"] as const;

export type GridVariant = (typeof GRID_VARIANTS)[number];

export const GRID_VARIANT_LABELS: Record<GridVariant, string> = {
  "2": "2 equal columns",
  "3": "3 equal columns",
  "4": "4 equal columns",
  "1/3+2/3": "1/3 + 2/3",
  "2/3+1/3": "2/3 + 1/3",
  "1/4+3/4": "1/4 + 3/4",
};

export const GRID_GAP_VALUES = { none: 0, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export type GridGap = keyof typeof GRID_GAP_VALUES;

export const GRID_GAP_LABELS: Record<GridGap, string> = {
  none: "None",
  sm: "Small (8px)",
  md: "Medium (16px)",
  lg: "Large (24px)",
  xl: "X-Large (32px)",
};

/** Fills a freshly dragged Grid so the canvas can render it immediately. */
export const gridDefaultProps = {
  variant: "2",
  gap: "md",
  col1: [],
  col2: [],
  col3: [],
  col4: [],
} as const;

export type GridProps = AdvancedBlockProps & {
  id?: string;
  variant: GridVariant;
  gap: GridGap;
  /** Column layout inside the tablet band (≤900px); unset inherits `variant`. */
  columnsTablet?: GridVariant;
  /** Column layout inside the mobile band (≤620px); unset inherits `variant`. */
  columnsMobile?: GridVariant;
  col1: Slot;
  col2: Slot;
  col3: Slot;
  col4: Slot;
  style?: BlockStyle;
};

export const gridPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  variant: z.enum(GRID_VARIANTS),
  gap: z.enum(Object.keys(GRID_GAP_VALUES) as [GridGap, ...GridGap[]]),
  columnsTablet: z.enum(GRID_VARIANTS).optional(),
  columnsMobile: z.enum(GRID_VARIANTS).optional(),
  col1: z.array(z.unknown()),
  col2: z.array(z.unknown()),
  col3: z.array(z.unknown()),
  col4: z.array(z.unknown()),
  style: blockStyleSchema.optional(),
});
