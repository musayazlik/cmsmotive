import { z } from "zod";
import { containerPropsSchema, type ContainerProps } from "./blocks/container/schema";
import { gridPropsSchema, type GridProps } from "./blocks/grid/schema";
import { headingPropsSchema, type HeadingProps } from "./blocks/heading/schema";
import { textPropsSchema, type TextProps } from "./blocks/text/schema";
import { PAGE_BUILDER_BLOCK_TYPES, isPageBuilderBlockType, slotFieldsOf, type PageBuilderBlockType } from "./slots";

/**
 * Document validation (plan 5.13): every block — including blocks nested in
 * the slot props declared in slots.ts — must carry a known type and props
 * that match its schema. Unknown keys, unknown block types, hostile style
 * values, duplicate block ids, unexpected root props and legacy DropZone data
 * are refused. Content cleaning is sanitize.ts's job (see document.ts).
 */

export { PAGE_BUILDER_BLOCK_TYPES, type PageBuilderBlockType };

export type UserBlocks = {
  ContainerBlock: ContainerProps;
  GridBlock: GridProps;
  HeadingBlock: HeadingProps;
  TextBlock: TextProps;
};

const PROPS_SCHEMAS: Record<PageBuilderBlockType, z.ZodType> = {
  ContainerBlock: containerPropsSchema,
  GridBlock: gridPropsSchema,
  HeadingBlock: headingPropsSchema,
  TextBlock: textPropsSchema,
};

/**
 * The block envelope (type/props/id) stays permissive — Puck may add editor
 * housekeeping fields between versions — but every prop set validated by
 * PROPS_SCHEMAS is strict.
 */
const blockSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  id: z.string().optional(),
});

/**
 * Root data. The config defines no root fields yet, so only Puck's default
 * `title` may appear; page settings (SEO, slug) live outside the document.
 */
const rootSchema = z.strictObject({
  props: z.strictObject({ title: z.string().max(200).optional() }).optional(),
});

const documentSchema = z.object({
  content: z.array(blockSchema),
  root: rootSchema,
  // Slots replaced DropZones; Puck still sends an empty object.
  zones: z.record(z.string(), z.array(blockSchema).max(0)).optional(),
});

export type DocumentValidation =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export function validateDocument(input: unknown): DocumentValidation {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Not a document." };
  const doc = input as { content?: unknown; zones?: unknown };
  const seen = new Set<string>();

  const parseBlock = (value: unknown, path: string): string[] => {
    if (typeof value !== "object" || value === null) return [`${path}: block is not an object`];
    const { type, props } = value as Record<string, unknown>;
    if (typeof type !== "string" || !isPageBuilderBlockType(type)) {
      return [`${path}: unknown block type ${String(type)}`];
    }
    const result = PROPS_SCHEMAS[type].safeParse(props);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join(".") ?? type;
      return [`${path} ${type}: ${field} — ${result.error.issues[0]?.message ?? "invalid props"}`];
    }
    const record = (props ?? {}) as Record<string, unknown>;
    // Two blocks with one id would share a scoped CSS rule (plan 5.1).
    if (typeof record.id === "string") {
      if (seen.has(record.id)) return [`${path} ${type}: duplicate block id ${record.id}`];
      seen.add(record.id);
    }
    const childErrors: string[] = [];
    for (const slot of slotFieldsOf(type)) {
      const slotValue = record[slot];
      if (!Array.isArray(slotValue)) continue; // the props schema already requires the array
      slotValue.forEach((nested, index) => childErrors.push(...parseBlock(nested, `${path} ${type} ${slot}[${index}]`)));
    }
    return childErrors;
  };

  const content = Array.isArray(doc.content) ? doc.content : [];
  const errors = content.flatMap((block, index) => parseBlock(block, `content[${index}]`));
  if (errors.length) return { ok: false, error: errors.slice(0, 3).join("; ") };

  const result = documentSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".") || "document"}: ${issue.message}` : "Invalid document." };
  }
  return { ok: true, data: result.data };
}
