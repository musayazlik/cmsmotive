import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";
import { advancedBlockPropsSchema, type AdvancedBlockProps } from "../shared";

export type LogoItem = {
  name: string;
  image: string;
  href?: string;
};

export const logoCloudDefaultProps = {
  title: "Trusted by forward-thinking organizations",
  logos: [
    { name: "Brand 1", image: "" },
    { name: "Brand 2", image: "" },
    { name: "Brand 3", image: "" },
    { name: "Brand 4", image: "" },
    { name: "Brand 5", image: "" },
  ],
} as const;

export type LogoCloudProps = AdvancedBlockProps & {
  id?: string;
  title?: string;
  logos?: LogoItem[];
  style?: BlockStyle;
};

export const logoCloudPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  ...advancedBlockPropsSchema,
  title: z.string().max(200).optional(),
  logos: z.array(
    z.object({
      name: z.string().min(1).max(100),
      image: z.string().max(500),
      href: z.string().max(500).optional(),
    }),
  ).optional(),
  style: blockStyleSchema.optional(),
});
