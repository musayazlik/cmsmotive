import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const contactDefaultProps = {
  title: "Get in touch with engineering",
  description: "Have questions about integration, enterprise licenses or custom extension development? Reach out directly to our team.",
  submitText: "Send Inquiry",
  showOffice: true,
} as const;

export type ContactProps = AdvancedBlockProps & {
  id?: string;
  title: string;
  description?: string;
  submitText?: string;
  showOffice?: boolean;
  style?: BlockStyle;
};

export const contactPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  submitText: z.string().max(100).optional(),
  showOffice: z.boolean().optional(),
  style: blockStyleSchema.optional(),
});
