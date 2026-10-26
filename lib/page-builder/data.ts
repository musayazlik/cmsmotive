import type { Content, Data } from "@puckeditor/core";
import { slotFieldsOf } from "./slots";

/**
 * Shared helpers over the Puck document. Type-only imports keep the editor
 * bundle out of the server page: only the JSX render configs touch Puck at
 * runtime, and only the client config touches the editor at all.
 */

export type PageBuilderData = Data;

/** A block in the draft: `{ type, props, id? }` as Puck stores it. */
export type BlockData = Content[number];

export function isBlockData(value: unknown): value is BlockData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string" &&
    "props" in value &&
    typeof (value as { props: unknown }).props === "object"
  );
}

/**
 * Depth-first walk over the document: visits every block, including blocks
 * nested inside the slot props declared in slots.ts. Other array props are
 * data, never descended into.
 */
export function walkBlocks(
  data: Pick<Data, "content">,
  visit: (block: BlockData) => void,
): void {
  const walk = (blocks: unknown[]): void => {
    for (const block of blocks) {
      if (!isBlockData(block)) continue;
      visit(block);
      const props = (block.props ?? {}) as Record<string, unknown>;
      for (const slot of slotFieldsOf(block.type)) {
        const value = props[slot];
        if (Array.isArray(value)) walk(value);
      }
    }
  };
  walk((data.content ?? []) as unknown[]);
}

/** Block ids across the whole document, in order. */
export function collectBlockIds(data: Pick<Data, "content">): string[] {
  const ids: string[] = [];
  walkBlocks(data, (block) => {
    const id = (block.props as { id?: unknown }).id;
    if (typeof id === "string") ids.push(id);
  });
  return ids;
}
