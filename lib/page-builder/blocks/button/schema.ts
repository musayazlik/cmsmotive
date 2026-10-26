import type { ReactNode } from "react";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

export const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost", "link"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export const SAFE_HREF_PATTERN = /^(?:https?:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*|mailto:[^\s"'<>]+|tel:[^\s"'<>]+|#[^\s"'<>]*)$/i;

export const buttonDefaultProps = {
  text: "Button",
  href: "#",
  variant: "primary",
  size: "md",
  target: "_self",
  fullWidth: false,
} as const;

export type ButtonProps = {
  id?: string;
  text: string | ReactNode;
  href: string;
  variant: ButtonVariant;
  size: ButtonSize;
  target?: "_self" | "_blank";
  fullWidth?: boolean;
  style?: BlockStyle;
};

export const buttonPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  text: z.string().min(1).max(200),
  href: z.string().regex(SAFE_HREF_PATTERN),
  variant: z.enum(BUTTON_VARIANTS),
  size: z.enum(BUTTON_SIZES),
  target: z.enum(["_self", "_blank"]).optional(),
  fullWidth: z.boolean().optional(),
  style: blockStyleSchema.optional(),
});
