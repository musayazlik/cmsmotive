/**
 * Advanced block attributes (plan 5.3 "Gelişmiş"): every block can carry an
 * element language (`lang`, BCP 47 — the same marks the rich text sanitizer
 * keeps), an ARIA label, and renders its block id as the anchor `id`. Shared
 * by all block schemas (validation) and renders (output); plain and
 * server-safe so both configs can use it.
 */

import { z } from "zod";

/**
 * BCP 47 tag: `de`, `en-US`, `zh-Hant`. Kept character-for-character identical
 * to LANGUAGE_TAG in lib/page-builder/sanitize.ts: a value this schema accepts
 * must survive the rich text sanitizer untouched, and vice versa.
 */
export const BCP47_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

/**
 * Puck's plain array field has no string mode: the editor writes `[{text}]`
 * rows while the schemas (and renderers) speak `string[]`. This preprocess
 * normalizes the editor shape on the document door, so the stored document
 * stays plain strings everywhere.
 */
export function textList<T extends z.ZodType>(inner: T) {
  return z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.map((item) => (item && typeof item === "object" && "text" in item ? String((item as { text?: unknown }).text ?? "") : item))
        : value,
    inner,
  );
}

export type AdvancedBlockProps = {
  /** Element language; rendered as the `lang` attribute on the block root. */
  lang?: string;
  /** Accessible name for landmark-ish blocks (sections etc.). */
  ariaLabel?: string;
};

/** A cleared text field arrives as "" — treat it as "not set", like optionalText. */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** Zod fragments spread into every block's props schema. */
export const advancedBlockPropsSchema = {
  lang: z.preprocess(emptyToUndefined, z.string().max(32).regex(BCP47_PATTERN).optional()),
  ariaLabel: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
};

/**
 * HTML attributes for a block's root element: the anchor `id` (the block id
 * is already unique per document), the element language and the ARIA label.
 */
export function blockAttributes(props: AdvancedBlockProps & { id?: string }): {
  id?: string;
  lang?: string;
  "aria-label"?: string;
} {
  return {
    ...(props.id ? { id: props.id } : {}),
    ...(props.lang ? { lang: props.lang } : {}),
    ...(props.ariaLabel ? { "aria-label": props.ariaLabel } : {}),
  };
}
