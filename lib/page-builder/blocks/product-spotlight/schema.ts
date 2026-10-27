import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";
import type { ResolvedProduct } from "../product-grid/schema";

export const productSpotlightDefaultProps = {
  productSlug: "",
  headline: "Spotlight Product",
  description: "Explore our featured enterprise product with outstanding performance.",
  ctaText: "Get Started",
} as const;

export type ProductSpotlightProps = AdvancedBlockProps & {
  id?: string;
  productSlug?: string;
  headline?: string;
  description?: string;
  ctaText?: string;
  style?: BlockStyle;
  _resolvedProduct?: ResolvedProduct | null;
};

export const productSpotlightPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  productSlug: z.string().max(100).optional(),
  headline: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  ctaText: z.string().max(100).optional(),
  style: blockStyleSchema.optional(),
  _resolvedProduct: z.any().optional(),
});
