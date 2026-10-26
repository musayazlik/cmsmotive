import type { ReactNode } from "react";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

/**
 * Heading (plan 5.2): H1–H4 whose text is editable directly on the canvas
 * (Puck text field with contentEditable). The editor converts the prop to a
 * node while editing; saved documents keep a plain string.
 */

export type HeadingLevel = "h1" | "h2" | "h3" | "h4";

export const HEADING_LEVELS = ["h1", "h2", "h3", "h4"] as const;

export const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  h1: "Title (H1)",
  h2: "Heading 2 (H2)",
  h3: "Heading 3 (H3)",
  h4: "Heading 4 (H4)",
};

/** Fills a freshly dragged Heading so `level` is always a renderable tag. */
export const headingDefaultProps = {
  text: "Heading",
  level: "h2",
} as const;

export type HeadingProps = {
  id?: string;
  /** Plain string in documents; a contentEditable node inside the editor canvas. */
  text: string | ReactNode;
  level: HeadingLevel;
  style?: BlockStyle;
};

export const headingPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  text: z.string().max(20000),
  level: z.enum(HEADING_LEVELS),
  style: blockStyleSchema.optional(),
});
