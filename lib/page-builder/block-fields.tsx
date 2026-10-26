import { StyleField } from "./style/fields";
import {
  buttonBaseFields,
  containerBaseFields,
  dividerBaseFields,
  gridBaseFields,
  headingBaseFields,
  iconBaseFields,
  imageBaseFields,
  listBaseFields,
  sectionBaseFields,
  spacerBaseFields,
  stackBaseFields,
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

export const textFields = { ...textBaseFields, style: styleField } as const;

export const buttonFields = { ...buttonBaseFields, style: styleField } as const;

export const imageFields = { ...imageBaseFields, style: styleField } as const;

export const videoFields = { ...videoBaseFields, style: styleField } as const;

export const iconFields = { ...iconBaseFields, style: styleField } as const;

export const listFields = { ...listBaseFields, style: styleField } as const;
