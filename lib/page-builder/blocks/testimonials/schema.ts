import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type TestimonialItem = {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;
};

export const testimonialsDefaultProps = {
  kicker: "Social Proof",
  title: "Loved by agencies and developers alike",
  items: [
    {
      quote: "CMSMotive themes allowed us to ship client projects three times faster without sacrificing any custom styling.",
      author: "Felix Bauer",
      role: "Lead Developer",
      company: "Agency 360",
      avatar: "",
      rating: 5,
    },
    {
      quote: "The cleanest code structure we have seen in TYPO3 ecosystem. Upgrading to v13 was completely effortless.",
      author: "Laura Schmidt",
      role: "CTO",
      company: "Nordic Digital",
      avatar: "",
      rating: 5,
    },
  ],
} as const;

export type TestimonialsProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title?: string;
  items?: TestimonialItem[];
  style?: BlockStyle;
};

export const testimonialsPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  items: z.array(
    z.object({
      quote: z.string().min(1).max(600),
      author: z.string().min(1).max(100),
      role: z.string().max(100).optional(),
      company: z.string().max(100).optional(),
      avatar: z.string().max(500).optional(),
      rating: z.number().int().min(1).max(5).optional(),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
