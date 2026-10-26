import { z } from "zod";
import { ID_PATTERN } from "../../ids";
import { blockStyleSchema, type BlockStyle } from "../../style/types";

export const LIST_STYLES = ["bullet", "number", "check", "plain"] as const;
export type ListStyle = (typeof LIST_STYLES)[number];

export type ListItemInput = {
  text: string;
};

export const listDefaultProps = {
  listStyle: "bullet",
  items: [],
} as const;

export type ListProps = {
  id?: string;
  listStyle: ListStyle;
  items: Array<ListItemInput & { id?: string }>;
  style?: BlockStyle;
};

export const listItemSchema = z.strictObject({
  text: z.string().min(1).max(500),
  id: z.string().max(64).optional(),
});

export const listPropsSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(ID_PATTERN).optional(),
  listStyle: z.enum(LIST_STYLES),
  items: z.array(listItemSchema).max(50),
  style: blockStyleSchema.optional(),
});
