import type { Content, Data } from "@puckeditor/core";
import { slotFieldsOf } from "./slots";
import { createBlockId } from "./ids";

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

/** Deep clone of the document with fresh, unique block ids across the whole tree. */
export function regenerateBlockIds(data: PageBuilderData): PageBuilderData {
  const cloned = JSON.parse(JSON.stringify(data)) as PageBuilderData;
  walkBlocks(cloned, (block) => {
    block.props = { ...(block.props ?? {}), id: createBlockId() };
  });
  return cloned;
}

/** The block with `id`, wherever it sits in the slot tree (null when gone). */
export function findBlockById(data: Pick<Data, "content">, id: string): BlockData | null {
  let found: BlockData | null = null;
  walkBlocks(data, (block) => {
    if (!found && (block.props as { id?: unknown }).id === id) found = block;
  });
  return found;
}

/** Depth-first rebuild of every content array, applying `fn` to each block. */
function mapBlockList(blocks: unknown[], fn: (block: BlockData) => BlockData): unknown[] {
  return blocks.map((block) => {
    if (!isBlockData(block)) return block;
    const next = fn(block);
    const props = { ...(next.props as Record<string, unknown>) };
    for (const slot of slotFieldsOf(next.type)) {
      const value = props[slot];
      if (Array.isArray(value)) props[slot] = mapBlockList(value, fn);
    }
    return { ...next, props };
  });
}

/** New document with `update` applied to the block whose props.id matches. */
export function updateBlockById(
  data: PageBuilderData,
  id: string,
  update: (block: BlockData) => BlockData,
): PageBuilderData {
  return { ...data, content: mapBlockList(data.content ?? [], (block) => ((block.props as { id?: unknown }).id === id ? update(block) : block)) as Data["content"] };
}
