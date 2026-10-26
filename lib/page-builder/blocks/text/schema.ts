import type { ReactNode } from "react";
import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

/**
 * Text (plan 5.2): Puck's Tiptap-based richtext output. The document keeps a
 * plain HTML string (validated string below); while editing, Puck replaces
 * the prop with its own editable node, so the render tolerates ReactNode.
 * The save action and the sanitizer are the only places allowed to treat it
 * as HTML.
 */

export type TextProps = {
  id?: string;
  content: string | ReactNode;
  style?: BlockStyle;
};

/** Fills a freshly dragged Text block so the paragraph is a visible target. */
export const textDefaultProps = {
  content: "<p>Text</p>",
} as const;

export const textPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  // 512 KB is generous for prose; keeps any document well under the 1 MB limit (plan 5.13).
  content: z.string().max(512 * 1024),
  style: blockStyleSchema.optional(),
});
