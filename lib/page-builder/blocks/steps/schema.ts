import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type StepItem = {
  stepNumber: string;
  title: string;
  description: string;
};

export const stepsDefaultProps = {
  kicker: "How it works",
  title: "Up and running in three straightforward steps",
  steps: [
    {
      stepNumber: "01",
      title: "Choose your product",
      description: "Browse themes and extensions tailored for TYPO3 enterprise setups.",
    },
    {
      stepNumber: "02",
      title: "Instant download & Composer setup",
      description: "Access zip archives or configure private Composer repository access in your account.",
    },
    {
      stepNumber: "03",
      title: "Deploy to production",
      description: "Integrate cleanly with your pipeline and launch with verified accessibility and SEO.",
    },
  ],
} as const;

export type StepsProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title?: string;
  steps?: StepItem[];
  style?: BlockStyle;
};

export const stepsPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  steps: z.array(
    z.object({
      stepNumber: z.string().min(1).max(10),
      title: z.string().min(1).max(100),
      description: z.string().min(1).max(500),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
