import type { Slot } from "@puckeditor/core";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

/**
 * Container (plan 5.2): the page's width bearer. Variants replace the
 * hand-tuned `.container` sizes used by the static pages (720/1200/1440/card).
 * Free styling still applies on top.
 */

export type ContainerVariant = "narrow" | "default" | "wide" | "full";

export const CONTAINER_VARIANTS = ["narrow", "default", "wide", "full"] as const;

export const CONTAINER_VARIANT_LABELS: Record<ContainerVariant, string> = {
  narrow: "Narrow (720px)",
  default: "Default (1200px)",
  wide: "Wide (1440px)",
  full: "Full width",
};

/** Fills a freshly dragged Container so the canvas can render it immediately. */
export const containerDefaultProps = {
  width: "default",
  children: [],
} as const;

export type ContainerProps = {
  /** Puck stores the block id inside props; the render maps it onto data-pb. */
  id?: string;
  width: ContainerVariant;
  children: Slot;
  style?: BlockStyle;
};

export const containerPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  width: z.enum(CONTAINER_VARIANTS),
  // Slot content is validated block-by-block by validate.ts, recursively.
  children: z.array(z.unknown()),
  style: blockStyleSchema.optional(),
});
