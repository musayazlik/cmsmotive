import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type ResolvedProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string | null;
  badge: string | null;
  priceFormatted: string | null;
  coverUrl: string | null;
};

export const productGridDefaultProps = {
  category: "",
  limit: 6,
  columns: 3,
  showFilter: true,
  showPrice: true,
} as const;

export type ProductGridProps = AdvancedBlockProps & {
  id?: string;
  category?: string;
  limit?: number;
  columns?: 2 | 3 | 4;
  showFilter?: boolean;
  showPrice?: boolean;
  style?: BlockStyle;
  _resolvedProducts?: ResolvedProduct[];
};

export const productGridPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  category: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(24).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  showFilter: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  style: blockStyleSchema.optional(),
  _resolvedProducts: z.array(z.any()).optional(),
});
