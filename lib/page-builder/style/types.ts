import { z } from "zod";

/**
 * Structured style values for every block (plan 5.3, Faz 1).
 * Values are never raw CSS: the editor writes typed objects, the zod schemas
 * below accept only whitelisted units, bounds and color formats, and
 * lib/page-builder/style/css.ts serializes them into the scoped stylesheet.
 * Groups: typography, spacing, background, border, size.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const LENGTH_UNITS = ["px", "rem", "%"] as const;
export const SIZE_UNITS = ["px", "rem"] as const;
export const TRACKING_UNITS = ["px", "em"] as const;
export const DIMENSION_UNITS = ["px", "rem", "%", "vw", "vh"] as const;
export const BORDER_STYLES = ["none", "solid", "dashed", "dotted"] as const;
/** Box-shadow presets (plan 5.3 "gölge ön ayarı") — fixed values, no free-form shadow. */
export const SHADOW_CHOICES = ["none", "sm", "md", "lg", "xl"] as const;
export const BG_SIZE_CHOICES = ["cover", "contain", "auto"] as const;
export const BG_POSITION_CHOICES = ["center", "top", "bottom", "left", "right"] as const;
export const BG_REPEAT_CHOICES = ["no-repeat", "repeat"] as const;

export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type SizeUnit = (typeof SIZE_UNITS)[number];
export type TrackingUnit = (typeof TRACKING_UNITS)[number];
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];
export type BorderStyleChoice = (typeof BORDER_STYLES)[number];
export type ShadowChoice = (typeof SHADOW_CHOICES)[number];
export type BgSizeChoice = (typeof BG_SIZE_CHOICES)[number];
export type BgPositionChoice = (typeof BG_POSITION_CHOICES)[number];
export type BgRepeatChoice = (typeof BG_REPEAT_CHOICES)[number];

export type CssLength = { value: number; unit: LengthUnit };
export type DimensionLength = { value: number; unit: DimensionUnit };

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
export const BORDER_WIDTH_BOUNDS = { min: 0, max: 32 } as const;
export const RADIUS_BOUNDS = { min: 0, max: 9999 } as const;
export const DIMENSION_BOUNDS = { min: 0, max: 3840 } as const;
export const FONT_SIZE_BOUNDS = { min: 6, max: 200 } as const;
export const FONT_WEIGHT_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const LINE_HEIGHT_BOUNDS = { min: 0.8, max: 2.4 } as const;
export const TRACKING_BOUNDS = { min: -0.12, max: 0.4 } as const;
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** Whitelist for image URLs: https:// or relative /api/media/... paths only (no data/javascript) */
export const SAFE_IMAGE_URL_PATTERN = /^(?:https:\/\/[a-z0-9_.-]+(?::[0-9]+)?(?:\/.*)?|\/(?:assets|api\/media)\/[a-z0-9_./-]+)$/i;
export const GRADIENT_ANGLE_BOUNDS = { min: 0, max: 360 } as const;
export const OVERLAY_OPACITY_BOUNDS = { min: 0, max: 1 } as const;

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

/** Two-stop linear gradient (plan 5.3 "2 duraklı gradyan"). Colors reuse ColorChoice so theme tokens bind to variables. */
export type GradientValues = {
  from: ColorChoice;
  to: ColorChoice;
  /** Direction in degrees; 180deg (top → bottom) is the common default. */
  angle: number;
};

export type BackgroundValues = {
  color?: ColorChoice;
  gradient?: GradientValues;
  image?: string;
  size?: BgSizeChoice;
  position?: BgPositionChoice;
  repeat?: BgRepeatChoice;
  /** Scrim drawn OVER the image/gradient (plan 5.3 "karartma rengi ve opaklık"). */
  overlayColor?: ColorChoice;
  /** 0–1; anything at 0 emits no overlay layer at all. */
  overlayOpacity?: number;
};

export type BorderValues = {
  width?: CssLength;
  style?: BorderStyleChoice;
  color?: ColorChoice;
  radius?: CssLength;
  shadow?: ShadowChoice;
};

export type SizeValues = {
  width?: DimensionLength;
  maxWidth?: DimensionLength;
  minWidth?: DimensionLength;
  height?: DimensionLength;
  maxHeight?: DimensionLength;
  minHeight?: DimensionLength;
};

/**
 * Hide the block on one or more screen bands (plan 5.3). The bands are the
 * site's own breakpoints and are disjoint, so the compiler can emit one
 * `display:none` media query per checked device without a cascade order.
 */
export type VisibilityValues = {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
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
  background?: Responsive<BackgroundValues>;
  border?: Responsive<BorderValues>;
  size?: Responsive<SizeValues>;
  visibility?: VisibilityValues;
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const lengthSchema = z.strictObject({
  value: z.number().min(LENGTH_BOUNDS.min).max(LENGTH_BOUNDS.max),
  unit: z.enum(LENGTH_UNITS),
});

const borderWidthSchema = z.strictObject({
  value: z.number().min(BORDER_WIDTH_BOUNDS.min).max(BORDER_WIDTH_BOUNDS.max),
  unit: z.enum(LENGTH_UNITS),
});

const radiusSchema = z.strictObject({
  value: z.number().min(RADIUS_BOUNDS.min).max(RADIUS_BOUNDS.max),
  unit: z.enum(LENGTH_UNITS),
});

const dimensionSchema = z.strictObject({
  value: z.number().min(DIMENSION_BOUNDS.min).max(DIMENSION_BOUNDS.max),
  unit: z.enum(DIMENSION_UNITS),
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

const backgroundSchema = z.strictObject({
  color: colorChoiceSchema.optional(),
  gradient: z
    .strictObject({
      from: colorChoiceSchema,
      to: colorChoiceSchema,
      angle: z.number().min(GRADIENT_ANGLE_BOUNDS.min).max(GRADIENT_ANGLE_BOUNDS.max),
    })
    .optional(),
  image: z.string().regex(SAFE_IMAGE_URL_PATTERN).optional(),
  size: z.enum(BG_SIZE_CHOICES).optional(),
  position: z.enum(BG_POSITION_CHOICES).optional(),
  repeat: z.enum(BG_REPEAT_CHOICES).optional(),
  overlayColor: colorChoiceSchema.optional(),
  overlayOpacity: z.number().min(OVERLAY_OPACITY_BOUNDS.min).max(OVERLAY_OPACITY_BOUNDS.max).optional(),
});

const borderSchema = z.strictObject({
  width: borderWidthSchema.optional(),
  style: z.enum(BORDER_STYLES).optional(),
  color: colorChoiceSchema.optional(),
  radius: radiusSchema.optional(),
  shadow: z.enum(SHADOW_CHOICES).optional(),
});

const sizeGroupSchema = z.strictObject({
  width: dimensionSchema.optional(),
  maxWidth: dimensionSchema.optional(),
  minWidth: dimensionSchema.optional(),
  height: dimensionSchema.optional(),
  maxHeight: dimensionSchema.optional(),
  minHeight: dimensionSchema.optional(),
});

const visibilitySchema = z.strictObject({
  desktop: z.boolean().optional(),
  tablet: z.boolean().optional(),
  mobile: z.boolean().optional(),
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
  background: z
    .strictObject({
      base: backgroundSchema,
      tablet: backgroundSchema.partial().optional(),
      mobile: backgroundSchema.partial().optional(),
    })
    .optional(),
  border: z
    .strictObject({
      base: borderSchema,
      tablet: borderSchema.partial().optional(),
      mobile: borderSchema.partial().optional(),
    })
    .optional(),
  size: z
    .strictObject({
      base: sizeGroupSchema,
      tablet: sizeGroupSchema.partial().optional(),
      mobile: sizeGroupSchema.partial().optional(),
    })
    .optional(),
  visibility: visibilitySchema.optional(),
});

function isFontWeightStep(value: number): boolean {
  return (FONT_WEIGHT_STEPS as readonly number[]).includes(value);
}

// ---------------------------------------------------------------------------
// Catalogs (fonts and theme colors come from our own assets — plan 5.5)
// ---------------------------------------------------------------------------

export const FONT_FAMILIES: ReadonlyArray<{ key: FontFamilyChoice; label: string; css: string }> = [
  { key: "sans", label: "Manrope (sans)", css: "Manrope, 'Segoe UI', sans-serif" },
  { key: "mono", label: "DM Mono (mono)", css: "'DM Mono', monospace" },
];

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
  { token: "line", label: "Border line" },
];

export const SHADOW_LABELS: Record<ShadowChoice, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "X-Large",
};
