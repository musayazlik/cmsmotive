import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type ResolvedReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  dateFormatted?: string;
  productName?: string;
};

export const reviewListDefaultProps = {
  productSlug: "",
  limit: 3,
  columns: 3,
} as const;

export type ReviewListProps = AdvancedBlockProps & {
  id?: string;
  productSlug?: string;
  limit?: number;
  columns?: 2 | 3;
  style?: BlockStyle;
  _resolvedReviews?: ResolvedReview[];
};

export const reviewListPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  productSlug: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(12).optional(),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  style: blockStyleSchema.optional(),
  _resolvedReviews: z.array(z.any()).optional(),
});
