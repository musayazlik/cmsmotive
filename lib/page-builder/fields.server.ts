import { CONTAINER_VARIANTS, CONTAINER_VARIANT_LABELS } from "./blocks/container/schema";
import { GRID_GAP_LABELS, GRID_GAP_VALUES, GRID_VARIANTS, GRID_VARIANT_LABELS, type GridGap } from "./blocks/grid/schema";
import { SECTION_VARIANTS, SECTION_VARIANT_LABELS } from "./blocks/section/schema";
import {
  STACK_ALIGNMENTS,
  STACK_DIRECTIONS,
  STACK_GAPS,
  STACK_JUSTIFY,
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

const option = <T extends string | number | boolean>(value: T, label: string) => ({ label, value });

/**
 * Advanced attributes shared by every block (plan 5.3 "Gelişmiş"). The props
 * exist on every schema (blocks/shared.ts), so Puck's `Fields` mapping needs
 * them declared here too — spread into every base set below, keeping the
 * editor and render configs in sync by construction.
 */
const advancedFields = {
  lang: { type: "text", label: "Element language (BCP 47, e.g. en-US)" },
  ariaLabel: { type: "text", label: "ARIA label" },
} as const;

export const containerBaseFields = {
  width: {
    type: "select",
    label: "Width",
    options: CONTAINER_VARIANTS.map((variant) => option(variant, CONTAINER_VARIANT_LABELS[variant])),
  },
  children: { type: "slot" },
  ...advancedFields,
} as const;

export const gridBaseFields = {
  variant: {
    type: "select",
    label: "Columns",
    options: GRID_VARIANTS.map((variant) => option(variant, GRID_VARIANT_LABELS[variant])),
  },
  columnsTablet: {
    type: "select",
    label: "Columns on tablet (≤900px)",
    options: [["", "Same as Columns"], ...GRID_VARIANTS.map((variant) => option(variant, GRID_VARIANT_LABELS[variant]))] as Array<[string, string]>,
  },
  columnsMobile: {
    type: "select",
    label: "Columns on mobile (≤620px)",
    options: [["", "Same as Columns"], ...GRID_VARIANTS.map((variant) => option(variant, GRID_VARIANT_LABELS[variant]))] as Array<[string, string]>,
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
  ...advancedFields,
} as const;

export const headingBaseFields = {
  // contentEditable puts the heading text straight onto the canvas (plan 5.2).
  text: { type: "text", contentEditable: true },
  level: {
    type: "select",
    label: "Level",
    options: HEADING_LEVELS.map((level) => option(level, HEADING_LEVEL_LABELS[level])),
  },
  ...advancedFields,
} as const;

export const textBaseFields = {
  // H1 belongs to the Heading block (one per page); sanitize.ts maps stray H1/H5/H6 the same way.
  content: { type: "richtext", options: { heading: { levels: [2, 3, 4] } } },
  ...advancedFields,
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
  ...advancedFields,
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
  ...advancedFields,
} as const;

export const spacerBaseFields = {
  size: {
    type: "select",
    label: "Height",
    options: SPACER_SIZES.map((size) => option(size, SPACER_SIZE_LABELS[size])),
  },
  ...advancedFields,
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
  ...advancedFields,
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
  ...advancedFields,
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
  ...advancedFields,
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
  ...advancedFields,
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
  ...advancedFields,
} as const;

export const listBaseFields = {
  listStyle: {
    type: "select",
    label: "List style",
    options: LIST_STYLES.map((listStyle) => option(listStyle, listStyle)),
  },
  items: { type: "array", label: "Items", itemFields: { text: { type: "text" } } },
  ...advancedFields,
} as const;

/* --- Live Data Blocks (Faz 2) --- */

export const productGridBaseFields = {
  category: { type: "text", label: "Category filter (optional)" },
  limit: { type: "number", label: "Max items" },
  columns: {
    type: "select",
    label: "Columns",
    options: [option(2, "2 Columns"), option(3, "3 Columns"), option(4, "4 Columns")],
  },
  showFilter: {
    type: "radio",
    label: "Show category filter",
    options: [option(true, "Yes"), option(false, "No")],
  },
  showPrice: {
    type: "radio",
    label: "Show price",
    options: [option(true, "Yes"), option(false, "No")],
  },
  ...advancedFields,
} as const;

export const productSpotlightBaseFields = {
  productSlug: { type: "text", label: "Product slug" },
  headline: { type: "text", label: "Headline override" },
  description: { type: "textarea", label: "Description override" },
  ctaText: { type: "text", label: "Button text" },
  ...advancedFields,
} as const;

export const pricingTableBaseFields = {
  title: { type: "text", label: "Title" },
  subtitle: { type: "text", label: "Subtitle" },
  plans: {
    type: "array",
    label: "Plans",
    itemFields: {
      name: { type: "text", label: "Plan Name" },
      price: { type: "text", label: "Price" },
      period: { type: "text", label: "Billing period" },
      description: { type: "text", label: "Description" },
      features: { type: "array", label: "Features", itemFields: { text: { type: "text" } } },
      ctaLabel: { type: "text", label: "Button label" },
      ctaHref: { type: "text", label: "Button link" },
      featured: {
        type: "radio",
        label: "Highlighted",
        options: [option(true, "Yes"), option(false, "No")],
      },
      productSlug: { type: "text", label: "Product slug (sync live price)" },
    },
  },
  ...advancedFields,
} as const;

export const reviewListBaseFields = {
  productSlug: { type: "text", label: "Product slug (empty for all)" },
  limit: { type: "number", label: "Max reviews" },
  columns: {
    type: "select",
    label: "Columns",
    options: [option(2, "2 Columns"), option(3, "3 Columns")],
  },
  ...advancedFields,
} as const;

export const latestPostsBaseFields = {
  limit: { type: "number", label: "Max posts" },
  columns: {
    type: "select",
    label: "Columns",
    options: [option(2, "2 Columns"), option(3, "3 Columns")],
  },
  ...advancedFields,
} as const;

/* --- Compound Section Blocks (Faz 2) --- */

export const heroBaseFields = {
  kicker: { type: "text", label: "Kicker / Eyebrow" },
  title: { type: "text", label: "Title" },
  subtitle: { type: "textarea", label: "Subtitle" },
  primaryButtonText: { type: "text", label: "Primary button label" },
  primaryButtonHref: { type: "text", label: "Primary button link" },
  secondaryButtonText: { type: "text", label: "Secondary button label" },
  secondaryButtonHref: { type: "text", label: "Secondary button link" },
  imageUrl: { type: "text", label: "Image URL" },
  align: {
    type: "select",
    label: "Alignment",
    options: [option("left", "Left"), option("center", "Center")],
  },
  ...advancedFields,
} as const;

export const featureGridBaseFields = {
  kicker: { type: "text", label: "Kicker" },
  title: { type: "text", label: "Title" },
  subtitle: { type: "text", label: "Subtitle" },
  columns: {
    type: "select",
    label: "Columns",
    options: [option(2, "2 Columns"), option(3, "3 Columns"), option(4, "4 Columns")],
  },
  items: {
    type: "array",
    label: "Features",
    itemFields: {
      icon: { type: "text", label: "Icon / Emoji" },
      title: { type: "text", label: "Title" },
      description: { type: "textarea", label: "Description" },
      href: { type: "text", label: "Link URL (optional)" },
    },
  },
  ...advancedFields,
} as const;

export const statsBaseFields = {
  items: {
    type: "array",
    label: "Stats",
    itemFields: {
      value: { type: "text", label: "Value (e.g. 99.9)" },
      suffix: { type: "text", label: "Suffix (e.g. % or +)" },
      label: { type: "text", label: "Label" },
      description: { type: "text", label: "Description" },
    },
  },
  ...advancedFields,
} as const;

export const logoCloudBaseFields = {
  title: { type: "text", label: "Title" },
  logos: {
    type: "array",
    label: "Logos",
    itemFields: {
      name: { type: "text", label: "Brand name" },
      image: { type: "text", label: "Logo image URL" },
      href: { type: "text", label: "Brand link (optional)" },
    },
  },
  ...advancedFields,
} as const;

export const testimonialsBaseFields = {
  kicker: { type: "text", label: "Kicker" },
  title: { type: "text", label: "Title" },
  items: {
    type: "array",
    label: "Quotes",
    itemFields: {
      quote: { type: "textarea", label: "Quote" },
      author: { type: "text", label: "Author name" },
      role: { type: "text", label: "Role" },
      company: { type: "text", label: "Company" },
      avatar: { type: "text", label: "Avatar image URL" },
      rating: { type: "number", label: "Rating (1–5)" },
    },
  },
  ...advancedFields,
} as const;

export const faqBaseFields = {
  kicker: { type: "text", label: "Kicker" },
  title: { type: "text", label: "Title" },
  subtitle: { type: "text", label: "Subtitle" },
  items: {
    type: "array",
    label: "Questions",
    itemFields: {
      question: { type: "text", label: "Question" },
      answer: { type: "textarea", label: "Answer" },
    },
  },
  ...advancedFields,
} as const;

export const ctaBaseFields = {
  title: { type: "text", label: "Title" },
  description: { type: "textarea", label: "Description" },
  buttonText: { type: "text", label: "Button label" },
  buttonHref: { type: "text", label: "Button link" },
  secondaryText: { type: "text", label: "Secondary button label" },
  secondaryHref: { type: "text", label: "Secondary button link" },
  variant: {
    type: "select",
    label: "Variant",
    options: [option("brand", "Brand (Indigo)"), option("plain", "Plain Surface"), option("dark", "Dark")],
  },
  ...advancedFields,
} as const;

export const comparisonTableBaseFields = {
  title: { type: "text", label: "Title" },
  columns: {
    type: "array",
    label: "Header columns",
    itemFields: { text: { type: "text" } },
  },
  rows: {
    type: "array",
    label: "Comparison rows",
    itemFields: {
      feature: { type: "text", label: "Feature name" },
      values: { type: "array", label: "Column values", itemFields: { text: { type: "text" } } },
    },
  },
  ...advancedFields,
} as const;

export const stepsBaseFields = {
  kicker: { type: "text", label: "Kicker" },
  title: { type: "text", label: "Title" },
  steps: {
    type: "array",
    label: "Steps",
    itemFields: {
      stepNumber: { type: "text", label: "Step Number (e.g. 01)" },
      title: { type: "text", label: "Title" },
      description: { type: "textarea", label: "Description" },
    },
  },
  ...advancedFields,
} as const;

export const newsletterBaseFields = {
  kicker: { type: "text", label: "Kicker" },
  title: { type: "text", label: "Title" },
  description: { type: "textarea", label: "Description" },
  buttonText: { type: "text", label: "Button label" },
  privacyNote: { type: "text", label: "Privacy consent text" },
  privacyVersion: { type: "text", label: "Consent version" },
  ...advancedFields,
} as const;

export const contactBaseFields = {
  title: { type: "text", label: "Title" },
  description: { type: "textarea", label: "Description" },
  submitText: { type: "text", label: "Submit button text" },
  showOffice: {
    type: "radio",
    label: "Show office/inquiry details",
    options: [option(true, "Yes"), option(false, "No")],
  },
  ...advancedFields,
} as const;

