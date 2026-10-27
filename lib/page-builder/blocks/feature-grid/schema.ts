import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type FeatureItem = {
  icon?: string;
  title: string;
  description: string;
  href?: string;
};

export const featureGridDefaultProps = {
  kicker: "Key Capabilities",
  title: "Engineered for Performance and Longevity",
  subtitle: "Every component is built according to strict TYPO3 and modern web accessibility guidelines.",
  columns: 3,
  items: [
    {
      icon: "⚡",
      title: "Blazing Fast Performance",
      description: "Optimized asset delivery, minimal DOM depth and responsive image pipelines.",
      href: "",
    },
    {
      icon: "♿",
      title: "WCAG 2.1 AA Compliant",
      description: "Screen-reader tested markup, accessible color contrast and full keyboard navigation.",
      href: "",
    },
    {
      icon: "🧩",
      title: "Modular Architecture",
      description: "Mix and match content components freely with atomic style isolation.",
      href: "",
    },
  ],
} as const;

export type FeatureGridProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  columns?: 2 | 3 | 4;
  items?: FeatureItem[];
  style?: BlockStyle;
};

export const featureGridPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  items: z.array(
    z.object({
      icon: z.string().max(50).optional(),
      title: z.string().min(1).max(100),
      description: z.string().min(1).max(500),
      href: z.string().max(500).optional(),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
