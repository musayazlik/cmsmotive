import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";
import { SAFE_HREF_PATTERN } from "../button/schema";

export const heroDefaultProps = {
  kicker: "Welcome to CMSMotive",
  title: "Modern Tools and Themes for TYPO3",
  subtitle: "Build enterprise websites faster with accessible, performant and beautifully designed templates.",
  primaryButtonText: "Explore Products",
  primaryButtonHref: "/products",
  secondaryButtonText: "Documentation",
  secondaryButtonHref: "#",
  imageUrl: "",
  align: "left",
} as const;

export type HeroProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  imageUrl?: string;
  align?: "left" | "center";
  style?: BlockStyle;
};

export const heroPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  primaryButtonText: z.string().max(100).optional(),
  primaryButtonHref: z.string().regex(SAFE_HREF_PATTERN).optional(),
  secondaryButtonText: z.string().max(100).optional(),
  secondaryButtonHref: z.string().regex(SAFE_HREF_PATTERN).optional(),
  imageUrl: z.string().max(500).optional(),
  align: z.enum(["left", "center"]).optional(),
  style: blockStyleSchema.optional(),
});
