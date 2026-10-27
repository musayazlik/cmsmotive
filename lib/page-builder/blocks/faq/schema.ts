import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type FaqItem = {
  question: string;
  answer: string;
};

export const faqDefaultProps = {
  kicker: "Questions & Answers",
  title: "Frequently Asked Questions",
  subtitle: "Everything you need to know about purchasing, licensing and updating.",
  items: [
    {
      question: "Which TYPO3 versions are supported?",
      answer: "All current themes and extensions support TYPO3 12 LTS and 13 LTS with continuous bugfix and security updates.",
    },
    {
      question: "Can I use the themes on client websites?",
      answer: "Yes, our Agency and Enterprise licences allow unlimited client installations and white-label deployments.",
    },
    {
      question: "How do updates and releases work?",
      answer: "Whenever a new version is released, you can download the updated zip archive or pull it via Composer from your account portal.",
    },
    {
      question: "Do you offer technical support?",
      answer: "Yes, our engineering team answers technical inquiries and provides troubleshooting assistance for all active licence holders.",
    },
  ],
} as const;

export type FAQProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  items?: FaqItem[];
  style?: BlockStyle;
};

export const faqPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  items: z.array(
    z.object({
      question: z.string().min(1).max(200),
      answer: z.string().min(1).max(1000),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
