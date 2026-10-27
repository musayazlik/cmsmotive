import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, SAFE_IMAGE_URL_PATTERN, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export const VIDEO_PROVIDERS = ["youtube", "vimeo"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const VIDEO_RATIOS = ["16/9", "4/3", "1/1"] as const;
export type VideoRatio = (typeof VIDEO_RATIOS)[number];

export const videoDefaultProps = {
  provider: "youtube",
  videoId: "",
  title: "Video",
  aspectRatio: "16/9",
} as const;

export type VideoProps = AdvancedBlockProps & {
  id?: string;
  provider: VideoProvider;
  videoId: string;
  title: string;
  poster?: string;
  aspectRatio?: VideoRatio;
  style?: BlockStyle;
};

export const videoPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  provider: z.enum(VIDEO_PROVIDERS),
  videoId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  poster: z.string().regex(SAFE_IMAGE_URL_PATTERN).optional(),
  aspectRatio: z.enum(VIDEO_RATIOS).optional(),
  style: blockStyleSchema.optional(),
});
