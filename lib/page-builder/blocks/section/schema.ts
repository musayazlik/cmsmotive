import type { Slot } from "@puckeditor/core";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, SAFE_IMAGE_URL_PATTERN, type BlockStyle, type ColorChoice } from "../../style/types";

export const SECTION_VARIANTS = ["plain", "muted", "dark", "brand", "image"] as const;
export type SectionVariant = (typeof SECTION_VARIANTS)[number];

export const SECTION_VARIANT_LABELS: Record<SectionVariant, string> = {
  plain: "Plain (surface background)",
  muted: "Muted (canvas tint)",
  dark: "Dark (ink background)",
  brand: "Brand (indigo tint)",
  image: "Image (with overlay)",
};

export const sectionDefaultProps = {
  variant: "plain",
  overlayOpacity: 50,
  children: [],
} as const;

export type SectionProps = {
  id?: string;
  variant: SectionVariant;
  image?: string;
  overlayOpacity?: number;
  children: Slot;
  style?: BlockStyle;
};

export const sectionPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  variant: z.enum(SECTION_VARIANTS),
  image: z.string().regex(SAFE_IMAGE_URL_PATTERN).optional(),
  overlayOpacity: z.number().min(0).max(100).optional(),
  children: z.array(z.unknown()),
  style: blockStyleSchema.optional(),
});
