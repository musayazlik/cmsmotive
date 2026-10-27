import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type StatItem = {
  value: string;
  suffix?: string;
  label: string;
  description?: string;
};

export const statsDefaultProps = {
  items: [
    { value: "99.9", suffix: "%", label: "Uptime SLA", description: "Proven reliability for high-traffic sites." },
    { value: "450", suffix: "+", label: "Enterprise Projects", description: "Deployed across leading European organizations." },
    { value: "100", suffix: "/100", label: "Core Web Vitals", description: "Optimal mobile & desktop performance." },
    { value: "24/7", suffix: "", label: "Engineering Support", description: "Direct access to senior CMS specialists." },
  ],
} as const;

export type StatsProps = AdvancedBlockProps & {
  id?: string;
  items?: StatItem[];
  style?: BlockStyle;
};

export const statsPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  items: z.array(
    z.object({
      value: z.string().min(1).max(50),
      suffix: z.string().max(20).optional(),
      label: z.string().min(1).max(100),
      description: z.string().max(300).optional(),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
