import { CONTAINER_VARIANTS, CONTAINER_VARIANT_LABELS } from "./blocks/container/schema";
import { GRID_GAP_LABELS, GRID_GAP_VALUES, GRID_VARIANTS, GRID_VARIANT_LABELS, type GridGap } from "./blocks/grid/schema";
import { HEADING_LEVELS, HEADING_LEVEL_LABELS } from "./blocks/heading/schema";

/**
 * Server-safe field declarations (Faz 0 kabul item 4, plan 5.16).
 *
 * The public route must keep every "use client" module out of its module
 * graph: Next 16 emits <script> tags for the chunks of every client module
 * referenced by a route, so a single client field component drags the whole
 * interactive @puckeditor/core bundle onto the public page. This module
 * therefore imports only plain schema constants.
 *
 * `<Render>` uses `useRichtextProps` on these declarations to map richtext
 * values (slot nodes → rendered output), so non-custom fields must stay in
 * sync with the editor declarations in block-fields.tsx. The interactive
 * `style` custom field is deliberately absent here: it is never used while
 * rendering.
 */

const option = <T extends string>(value: T, label: string) => ({ label, value });

export const containerBaseFields = {
  width: {
    type: "select",
    label: "Width",
    options: CONTAINER_VARIANTS.map((variant) => option(variant, CONTAINER_VARIANT_LABELS[variant])),
  },
  children: { type: "slot" },
} as const;

export const gridBaseFields = {
  variant: {
    type: "select",
    label: "Columns",
    options: GRID_VARIANTS.map((variant) => option(variant, GRID_VARIANT_LABELS[variant])),
  },
  gap: {
    type: "select",
    label: "Gap",
    options: (Object.keys(GRID_GAP_VALUES) as GridGap[]).map((gap) => option(gap, GRID_GAP_LABELS[gap])),
  },
  col1: { type: "slot" },
  col2: { type: "slot" },
  col3: { type: "slot" },
  col4: { type: "slot" },
} as const;

export const headingBaseFields = {
  // contentEditable puts the heading text straight onto the canvas (plan 5.2).
  text: { type: "text", contentEditable: true },
  level: {
    type: "select",
    label: "Level",
    options: HEADING_LEVELS.map((level) => option(level, HEADING_LEVEL_LABELS[level])),
  },
} as const;

export const textBaseFields = {
  // H1 belongs to the Heading block (one per page); sanitize.ts maps stray H1/H5/H6 the same way.
  content: { type: "richtext", options: { heading: { levels: [2, 3, 4] } } },
} as const;
