import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  productSlug?: string;
};

export const pricingTableDefaultProps = {
  title: "Simple, transparent pricing",
  subtitle: "Choose the package that fits your organization.",
  plans: [
    {
      name: "Starter",
      price: "€49",
      period: "one-time",
      description: "Everything you need to launch a single website.",
      features: ["1 TYPO3 installation", "Standard updates", "Community support"],
      ctaLabel: "Get Starter",
      ctaHref: "#",
      featured: false,
    },
    {
      name: "Agency",
      price: "€149",
      period: "one-time",
      description: "Designed for web agencies building multiple client projects.",
      features: ["Unlimited installations", "Priority support", "Full source code", "White-label rights"],
      ctaLabel: "Get Agency",
      ctaHref: "#",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "€399",
      period: "one-time",
      description: "Custom solutions for large organisations and mission-critical setups.",
      features: ["Dedicated SLA", "Custom extensions", "Audit assistance", "Direct engineering contact"],
      ctaLabel: "Contact Us",
      ctaHref: "/contact",
      featured: false,
    },
  ],
} as const;

export type PricingTableProps = AdvancedBlockProps & {
  id?: string;
  title?: string;
  subtitle?: string;
  plans?: PricingPlan[];
  style?: BlockStyle;
  _resolvedPrices?: Record<string, string>;
};

export const pricingTablePropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  plans: z.array(
    z.object({
      name: z.string().min(1).max(100),
      price: z.string().max(50),
      period: z.string().max(50),
      description: z.string().max(300),
      features: z.array(z.string().max(200)),
      ctaLabel: z.string().max(100),
      ctaHref: z.string().max(500),
      featured: z.boolean(),
      productSlug: z.string().max(100).optional(),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
  _resolvedPrices: z.record(z.string(), z.string()).optional(),
});
