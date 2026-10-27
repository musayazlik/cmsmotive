import { StyleField } from "./style/fields";
import { LinkField } from "./fields/link-field";
import { ProductPicker } from "./fields/product-picker";
import { langInlineMenu, LangMark } from "./editor-lang";
import {
  buttonBaseFields,
  comparisonTableBaseFields,
  contactBaseFields,
  containerBaseFields,
  ctaBaseFields,
  dividerBaseFields,
  faqBaseFields,
  featureGridBaseFields,
  gridBaseFields,
  headingBaseFields,
  heroBaseFields,
  iconBaseFields,
  imageBaseFields,
  latestPostsBaseFields,
  listBaseFields,
  logoCloudBaseFields,
  newsletterBaseFields,
  pricingTableBaseFields,
  productGridBaseFields,
  productSpotlightBaseFields,
  reviewListBaseFields,
  sectionBaseFields,
  spacerBaseFields,
  stackBaseFields,
  statsBaseFields,
  stepsBaseFields,
  testimonialsBaseFields,
  textBaseFields,
  videoBaseFields,
} from "./fields.server";
import type { BlockStyle } from "./style/types";

/**
 * Editor field declarations for config.client (plan 5.16). Built from the
 * server-safe base declarations in fields.server.ts — the two configs stay
 * in sync by construction — plus the interactive StyleField, which must only
 * be reachable from client/graph routes (see fields.server.ts header).
 *
 * Explicit declarations matter for every prop — Puck's `Fields` type maps
 * over all component props, partial field sets are type errors.
 *
 * Do not add a "use client" here: the StyleField client boundary comes with
 * style/fields.tsx.
 */

const styleField = {
  type: "custom",
  label: "Style",
  render: (params: { name: string; value: BlockStyle | undefined; onChange: (value: BlockStyle) => void }) => (
    <StyleField name={params.name} value={params.value} onChange={params.onChange} />
  ),
} as const;

export const containerFields = { ...containerBaseFields, style: styleField } as const;

export const gridFields = { ...gridBaseFields, style: styleField } as const;

export const sectionFields = { ...sectionBaseFields, style: styleField } as const;

export const stackFields = { ...stackBaseFields, style: styleField } as const;

export const spacerFields = { ...spacerBaseFields, style: styleField } as const;

export const dividerFields = { ...dividerBaseFields, style: styleField } as const;

export const headingFields = { ...headingBaseFields, style: styleField } as const;

export const textFields = {
  ...textBaseFields,
  content: {
    ...textBaseFields.content,
    // The `lang` mark keeps foreign-language phrases screen-reader correct
    // (plan 5.3); the sanitizer accepts the exact span it produces.
    tiptap: { extensions: [LangMark] },
    renderInlineMenu: langInlineMenu,
  },
  style: styleField,
} as const;

export const buttonFields = { ...buttonBaseFields, style: styleField } as const;

export const imageFields = { ...imageBaseFields, style: styleField } as const;

export const videoFields = { ...videoBaseFields, style: styleField } as const;

export const iconFields = { ...iconBaseFields, style: styleField } as const;

export const listFields = { ...listBaseFields, style: styleField } as const;

export const productGridFields = { ...productGridBaseFields, style: styleField } as const;

export const productSpotlightFields = {
  ...productSpotlightBaseFields,
  productSlug: {
    type: "custom",
    label: "Product",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <ProductPicker value={value} onChange={onChange} label="Product" />
    ),
  },
  style: styleField,
} as const;

export const pricingTableFields = { ...pricingTableBaseFields, style: styleField } as const;

export const reviewListFields = {
  ...reviewListBaseFields,
  productSlug: {
    type: "custom",
    label: "Filter by product",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <ProductPicker value={value} onChange={onChange} label="Filter by product (optional)" />
    ),
  },
  style: styleField,
} as const;

export const latestPostsFields = { ...latestPostsBaseFields, style: styleField } as const;

export const heroFields = {
  ...heroBaseFields,
  primaryButtonHref: {
    type: "custom",
    label: "Primary link",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <LinkField value={value} onChange={onChange} label="Primary link" />
    ),
  },
  secondaryButtonHref: {
    type: "custom",
    label: "Secondary link",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <LinkField value={value} onChange={onChange} label="Secondary link" />
    ),
  },
  style: styleField,
} as const;

export const featureGridFields = { ...featureGridBaseFields, style: styleField } as const;

export const statsFields = { ...statsBaseFields, style: styleField } as const;

export const logoCloudFields = { ...logoCloudBaseFields, style: styleField } as const;

export const testimonialsFields = { ...testimonialsBaseFields, style: styleField } as const;

export const faqFields = { ...faqBaseFields, style: styleField } as const;

export const ctaFields = {
  ...ctaBaseFields,
  buttonHref: {
    type: "custom",
    label: "Button link",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <LinkField value={value} onChange={onChange} label="Button link" />
    ),
  },
  secondaryHref: {
    type: "custom",
    label: "Secondary link",
    render: ({ value, onChange }: { value?: string; onChange: (val: string) => void }) => (
      <LinkField value={value} onChange={onChange} label="Secondary link" />
    ),
  },
  style: styleField,
} as const;

export const comparisonTableFields = { ...comparisonTableBaseFields, style: styleField } as const;

export const stepsFields = { ...stepsBaseFields, style: styleField } as const;

export const newsletterFields = { ...newsletterBaseFields, style: styleField } as const;

export const contactFields = { ...contactBaseFields, style: styleField } as const;
