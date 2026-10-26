/**
 * Slot props per block type (plan 5.13). Only these props hold nested blocks;
 * every other array prop (FAQ items, feature lists…) is plain data. Walking,
 * validating, sanitizing and compiling CSS all read this one list instead of
 * guessing from the value's shape.
 *
 * Plain constants, no imports: shared by the editor, the public render and
 * the save path alike.
 */
export const SLOT_FIELDS = {
  ContainerBlock: ["children"],
  GridBlock: ["col1", "col2", "col3", "col4"],
  HeadingBlock: [],
  TextBlock: [],
} as const satisfies Record<string, readonly string[]>;

export type PageBuilderBlockType = keyof typeof SLOT_FIELDS;

export const PAGE_BUILDER_BLOCK_TYPES = Object.keys(SLOT_FIELDS) as PageBuilderBlockType[];

export function isPageBuilderBlockType(type: string): type is PageBuilderBlockType {
  return Object.prototype.hasOwnProperty.call(SLOT_FIELDS, type);
}

/** The slot prop names of a block type; none for unknown types. */
export function slotFieldsOf(type: string): readonly string[] {
  return isPageBuilderBlockType(type) ? SLOT_FIELDS[type] : [];
}
