import { z } from "zod";

/**
 * Structured style values for every block (plan 5.3). Values are never raw
 * CSS: the editor writes typed objects, the zod schemas below accept only
 * whitelisted units and color formats, and lib/page-builder/style/css.ts
 * serializes them into the scoped stylesheet. Phase 0 ships the typography
 * and spacing groups; background, border and size groups follow in Phase 1
 * by extending these records (migrate() fills the defaults).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Units and bounds per property — the panel offers only these. */
export const LENGTH_UNITS = ["px", "rem"] as const;
export const SIZE_UNITS = ["px", "rem"] as const;
export const TRACKING_UNITS = ["px", "em"] as const;

export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type SizeUnit = (typeof SIZE_UNITS)[number];
export type TrackingUnit = (typeof TRACKING_UNITS)[number];

export type CssLength = { value: number; unit: LengthUnit };

export type FontFamilyChoice = "sans" | "mono";

export type FontSize = { value: number; unit: SizeUnit };
export type LetterSpacing = { value: number; unit: TrackingUnit };

/** Free HEX (`#rgb`, `#rrggbb`, `#rrggbbaa`) or a site token rendered as `var(--token)`. */
export type ColorChoice = { source: "raw"; value: string } | { source: "token"; value: string };

export type TextAlignChoice = "left" | "center" | "right" | "justify";

// ---------------------------------------------------------------------------
// Value rules (shared by the editor panel and document validation)
// ---------------------------------------------------------------------------

export const LENGTH_BOUNDS = { min: -80, max: 360 } as const;
export const FONT_SIZE_BOUNDS = { min: 6, max: 200 } as const;
export const FONT_WEIGHT_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const LINE_HEIGHT_BOUNDS = { min: 0.8, max: 2.4 } as const;
export const TRACKING_BOUNDS = { min: -0.12, max: 0.4 } as const;
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// ---------------------------------------------------------------------------
// Group records
// ---------------------------------------------------------------------------

export type TypographyValues = {
  fontFamily?: FontFamilyChoice;
  fontSize?: FontSize;
  fontWeight?: (typeof FONT_WEIGHT_STEPS)[number];
  lineHeight?: number;
  letterSpacing?: LetterSpacing;
  textAlign?: TextAlignChoice;
  textColor?: ColorChoice;
};

export type SpacingValues = {
  marginTop?: CssLength;
  marginRight?: CssLength;
  marginBottom?: CssLength;
  marginLeft?: CssLength;
  paddingTop?: CssLength;
  paddingRight?: CssLength;
  paddingBottom?: CssLength;
  paddingLeft?: CssLength;
};

/**
 * Desktop holds the primary value; tablet and mobile hold optional
 * overrides. css.ts emits each device into its own media query, so the
 * browser cascade resolves base → tablet → mobile without merging here.
 */
export type Responsive<T> = { base: T; tablet?: Partial<T>; mobile?: Partial<T> };

export type BlockStyle = {
  typography?: Responsive<TypographyValues>;
  spacing?: Responsive<SpacingValues>;
};

// ---------------------------------------------------------------------------
// Zod schemas — every numeric field carries its own bounds, so the editor
// panel and save validation share the exact same rules.
// ---------------------------------------------------------------------------

const lengthSchema = z.strictObject({
  value: z.number().min(LENGTH_BOUNDS.min).max(LENGTH_BOUNDS.max),
  unit: z.enum(LENGTH_UNITS),
});

const sizeSchema = z.strictObject({
  value: z.number().min(FONT_SIZE_BOUNDS.min).max(FONT_SIZE_BOUNDS.max),
  unit: z.enum(SIZE_UNITS),
});

const trackingSchema = z.strictObject({
  value: z.number().min(TRACKING_BOUNDS.min).max(TRACKING_BOUNDS.max),
  unit: z.enum(TRACKING_UNITS),
});

const colorChoiceSchema = z.discriminatedUnion("source", [
  z.strictObject({ source: z.literal("raw"), value: z.string().regex(HEX_COLOR_PATTERN) }),
  z.strictObject({ source: z.literal("token"), value: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
]);

const typographySchema = z.strictObject({
  fontFamily: z.enum(["sans", "mono"]).optional(),
  fontSize: sizeSchema.optional(),
  fontWeight: z.number().int().refine(isFontWeightStep).optional(),
  lineHeight: z.number().min(LINE_HEIGHT_BOUNDS.min).max(LINE_HEIGHT_BOUNDS.max).optional(),
  letterSpacing: trackingSchema.optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  textColor: colorChoiceSchema.optional(),
});

const spacingSchema = z.strictObject({
  marginTop: lengthSchema.optional(),
  marginRight: lengthSchema.optional(),
  marginBottom: lengthSchema.optional(),
  marginLeft: lengthSchema.optional(),
  paddingTop: lengthSchema.optional(),
  paddingRight: lengthSchema.optional(),
  paddingBottom: lengthSchema.optional(),
  paddingLeft: lengthSchema.optional(),
});

export const blockStyleSchema = z.strictObject({
  typography: z
    .strictObject({
      base: typographySchema,
      tablet: typographySchema.partial().optional(),
      mobile: typographySchema.partial().optional(),
    })
    .optional(),
  spacing: z
    .strictObject({
      base: spacingSchema,
      tablet: spacingSchema.partial().optional(),
      mobile: spacingSchema.partial().optional(),
    })
    .optional(),
});

function isFontWeightStep(value: number): boolean {
  return (FONT_WEIGHT_STEPS as readonly number[]).includes(value);
}

// ---------------------------------------------------------------------------
// Catalogs (fonts and theme colors come from our own assets — plan 5.5)
// ---------------------------------------------------------------------------

/** Values rendered into the scoped CSS; the picker lists only these. */
export const FONT_FAMILIES: ReadonlyArray<{ key: FontFamilyChoice; label: string; css: string }> = [
  { key: "sans", label: "Manrope (sans)", css: "Manrope, 'Segoe UI', sans-serif" },
  { key: "mono", label: "DM Mono (mono)", css: "'DM Mono', monospace" },
];

/** Tokens defined in public/assets/css/site.css :root, offered as quick picks. */
export const COLOR_TOKENS: ReadonlyArray<{ token: string; label: string }> = [
  { token: "indigo", label: "Indigo" },
  { token: "ink", label: "Ink" },
  { token: "ink-muted", label: "Muted ink" },
  { token: "muted", label: "Muted" },
  { token: "canvas", label: "Canvas" },
  { token: "surface", label: "Surface" },
  { token: "lime", label: "Lime" },
  { token: "dark", label: "Dark" },
  { token: "success", label: "Success" },
  { token: "warn", label: "Warn" },
];
