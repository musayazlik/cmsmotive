import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, SAFE_IMAGE_URL_PATTERN, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const IMAGE_FITS = ["cover", "contain", "none"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

export const IMAGE_ROUNDED = ["none", "sm", "md", "lg", "full"] as const;
export type ImageRounded = (typeof IMAGE_ROUNDED)[number];

export const imageDefaultProps = {
  src: "",
  alt: "",
  decorative: false,
  loading: "lazy",
  fit: "cover",
  rounded: "md",
} as const;

export type ImageProps = AdvancedBlockProps & {
  id?: string;
  src: string;
  alt: string;
  decorative?: boolean;
  caption?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fit?: ImageFit;
  rounded?: ImageRounded;
  style?: BlockStyle;
};

export const imagePropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  src: z.string().regex(SAFE_IMAGE_URL_PATTERN),
  alt: z.string().max(300),
  decorative: z.boolean().optional(),
  caption: z.string().max(300).optional(),
  width: z.number().int().min(1).max(10000).optional(),
  height: z.number().int().min(1).max(10000).optional(),
  loading: z.enum(["lazy", "eager"]).optional(),
  fit: z.enum(IMAGE_FITS).optional(),
  rounded: z.enum(IMAGE_ROUNDED).optional(),
  style: blockStyleSchema.optional(),
});
