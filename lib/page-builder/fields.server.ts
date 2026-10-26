import { CONTAINER_VARIANTS, CONTAINER_VARIANT_LABELS } from "./blocks/container/schema";
import { GRID_GAP_LABELS, GRID_GAP_VALUES, GRID_VARIANTS, GRID_VARIANT_LABELS, type GridGap } from "./blocks/grid/schema";
import { SECTION_VARIANTS, SECTION_VARIANT_LABELS } from "./blocks/section/schema";
import {
  STACK_ALIGNMENTS,
  STACK_DIRECTIONS,
  STACK_GAPS,
  STACK_JUSTIFY,
  type StackAlign,
  type StackGap,
  type StackJustify,
} from "./blocks/stack/schema";
import { SPACER_SIZES, SPACER_SIZE_LABELS } from "./blocks/spacer/schema";
import { DIVIDER_SPACINGS, DIVIDER_VARIANTS } from "./blocks/divider/schema";
import { HEADING_LEVELS, HEADING_LEVEL_LABELS } from "./blocks/heading/schema";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "./blocks/button/schema";
import { IMAGE_FITS, IMAGE_ROUNDED } from "./blocks/image/schema";
import { VIDEO_PROVIDERS, VIDEO_RATIOS } from "./blocks/video/schema";
import { ICON_NAMES, ICON_SIZES } from "./blocks/icon/schema";
import { LIST_STYLES } from "./blocks/list/schema";

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

export const sectionBaseFields = {
  variant: {
    type: "select",
    label: "Variant",
    options: SECTION_VARIANTS.map((variant) => option(variant, SECTION_VARIANT_LABELS[variant])),
  },
  image: { type: "text", label: "Background image URL" },
  overlayOpacity: { type: "number", label: "Overlay opacity (0–100)" },
  children: { type: "slot" },
} as const;

export const stackBaseFields = {
  direction: {
    type: "select",
    label: "Direction",
    options: STACK_DIRECTIONS.map((direction) => option(direction, direction === "vertical" ? "Vertical" : "Horizontal")),
  },
  gap: {
    type: "select",
    label: "Gap",
    options: STACK_GAPS.map((gap) => option(gap, gap === "none" ? "None" : gap.toUpperCase())),
  },
  align: {
    type: "select",
    label: "Align",
    options: STACK_ALIGNMENTS.map((align) => option(align, align)),
  },
  justify: {
    type: "select",
    label: "Justify",
    options: STACK_JUSTIFY.map((justify) => option(justify, justify === "between" ? "Space between" : justify)),
  },
  wrap: { type: "toggle", label: "Wrap items" },
  children: { type: "slot" },
} as const;

export const spacerBaseFields = {
  size: {
    type: "select",
    label: "Height",
    options: SPACER_SIZES.map((size) => option(size, SPACER_SIZE_LABELS[size])),
  },
} as const;

export const dividerBaseFields = {
  variant: {
    type: "select",
    label: "Line style",
    options: DIVIDER_VARIANTS.map((variant) => option(variant, variant)),
  },
  spacing: {
    type: "select",
    label: "Spacing",
    options: DIVIDER_SPACINGS.map((spacing) => option(spacing, spacing.toUpperCase())),
  },
} as const;

export const buttonBaseFields = {
  text: { type: "text", label: "Label" },
  href: { type: "text", label: "Link URL" },
  variant: {
    type: "select",
    label: "Variant",
    options: BUTTON_VARIANTS.map((variant) => option(variant, variant)),
  },
  size: {
    type: "select",
    label: "Size",
    options: BUTTON_SIZES.map((size) => option(size, size.toUpperCase())),
  },
  target: {
    type: "select",
    label: "Opens",
    options: [
      option("_self", "Same tab"),
      option("_blank", "New tab"),
    ],
  },
  fullWidth: { type: "toggle", label: "Full width" },
} as const;

export const imageBaseFields = {
  src: { type: "text", label: "Image URL" },
  alt: { type: "text", label: "Alternative text" },
  decorative: { type: "toggle", label: "Decorative image" },
  caption: { type: "text", label: "Caption" },
  loading: {
    type: "select",
    label: "Loading",
    options: [
      option("lazy", "Lazy (below the fold)"),
      option("eager", "Eager (hero)"),
    ],
  },
  fit: {
    type: "select",
    label: "Object fit",
    options: IMAGE_FITS.map((fit) => option(fit, fit)),
  },
  rounded: {
    type: "select",
    label: "Corner rounding",
    options: IMAGE_ROUNDED.map((rounded) => option(rounded, rounded)),
  },
} as const;

export const videoBaseFields = {
  provider: {
    type: "select",
    label: "Provider",
    options: VIDEO_PROVIDERS.map((provider) => option(provider, provider === "youtube" ? "YouTube" : "Vimeo")),
  },
  videoId: { type: "text", label: "Video ID" },
  title: { type: "text", label: "Title (screen readers)" },
  poster: { type: "text", label: "Preview image URL" },
  aspectRatio: {
    type: "select",
    label: "Aspect ratio",
    options: VIDEO_RATIOS.map((ratio) => option(ratio, ratio)),
  },
} as const;

export const iconBaseFields = {
  name: {
    type: "select",
    label: "Icon",
    options: ICON_NAMES.map((name) => option(name, name)),
  },
  size: {
    type: "select",
    label: "Size",
    options: ICON_SIZES.map((size) => option(size, size.toUpperCase())),
  },
} as const;

export const listBaseFields = {
  listStyle: {
    type: "select",
    label: "List style",
    options: LIST_STYLES.map((listStyle) => option(listStyle, listStyle)),
  },
  items: { type: "array", label: "Items", itemFields: { text: { type: "text" } } },
} as const;
