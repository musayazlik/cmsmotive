import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type ComparisonRow = {
  feature: string;
  values: string[];
};

export const comparisonTableDefaultProps = {
  title: "Compare Editions",
  columns: ["Features", "Starter", "Agency", "Enterprise"],
  rows: [
    { feature: "TYPO3 12 & 13 Support", values: ["✓", "✓", "✓"] },
    { feature: "Installations", values: ["1 Site", "Unlimited", "Unlimited"] },
    { feature: "Full Source Code", values: ["✓", "✓", "✓"] },
    { feature: "Headless REST APIs", values: ["—", "✓", "✓"] },
    { feature: "Direct Engineering SLA", values: ["—", "—", "✓"] },
  ],
} as const;

export type ComparisonTableProps = AdvancedBlockProps & {
  id?: string;
  title?: string;
  columns?: string[];
  rows?: ComparisonRow[];
  style?: BlockStyle;
};

export const comparisonTablePropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  title: z.string().max(200).optional(),
  columns: z.array(z.string().max(100)).optional(),
  rows: z.array(
    z.object({
      feature: z.string().min(1).max(100),
      values: z.array(z.string().max(100)),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
