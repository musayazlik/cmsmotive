import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";
import { SAFE_HREF_PATTERN } from "../button/schema";

export const CTA_VARIANTS = ["plain", "brand", "dark"] as const;
export type CtaVariant = (typeof CTA_VARIANTS)[number];

export const ctaDefaultProps = {
  title: "Ready to accelerate your next TYPO3 project?",
  description: "Join hundreds of professional agencies building robust websites with our themes and tools.",
  buttonText: "Browse All Products",
  buttonHref: "/products",
  secondaryText: "Contact Sales",
  secondaryHref: "/contact",
  variant: "brand",
} as const;

export type CTAProps = AdvancedBlockProps & {
  id?: string;
  title: string;
  description?: string;
  buttonText: string;
  buttonHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  variant?: CtaVariant;
  style?: BlockStyle;
};

export const ctaPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  buttonText: z.string().min(1).max(100),
  buttonHref: z.string().regex(SAFE_HREF_PATTERN),
  secondaryText: z.string().max(100).optional(),
  secondaryHref: z.string().regex(SAFE_HREF_PATTERN).optional(),
  variant: z.enum(CTA_VARIANTS).optional(),
  style: blockStyleSchema.optional(),
});
