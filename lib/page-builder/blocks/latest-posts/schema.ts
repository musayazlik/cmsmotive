import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type ResolvedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingTime: number;
  publishedDate?: string;
  category?: string | null;
  coverUrl?: string | null;
};

export const latestPostsDefaultProps = {
  limit: 3,
  columns: 3,
} as const;

export type LatestPostsProps = AdvancedBlockProps & {
  id?: string;
  limit?: number;
  columns?: 2 | 3;
  style?: BlockStyle;
  _resolvedPosts?: ResolvedPost[];
};

export const latestPostsPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  limit: z.number().int().min(1).max(12).optional(),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  style: blockStyleSchema.optional(),
  _resolvedPosts: z.array(z.any()).optional(),
});
