import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const newsletterDefaultProps = {
  kicker: "Stay Informed",
  title: "Subscribe to our engineering newsletter",
  description: "Get occasional updates on TYPO3 security, releases, and architecture patterns. No spam.",
  buttonText: "Subscribe",
  privacyNote: "I agree to the privacy policy and consent to receiving newsletter communications.",
} as const;

export type NewsletterProps = AdvancedBlockProps & {
  id?: string;
  kicker?: string;
  title: string;
  description?: string;
  buttonText?: string;
  privacyNote?: string;
  privacyVersion?: string;
  style?: BlockStyle;
};

export const newsletterPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  kicker: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  buttonText: z.string().max(100).optional(),
  privacyNote: z.string().max(300).optional(),
  privacyVersion: z.string().max(50).optional(),
  style: blockStyleSchema.optional(),
});
