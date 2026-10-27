import { walkBlocks, type BlockData, type PageBuilderData } from "../data";
import { ID_PATTERN } from "../ids";
import { GRID_VARIANTS, GRID_GAP_VALUES, type GridVariant, type GridGap } from "../blocks/grid/schema";
import {
  BORDER_STYLES,
  BG_POSITION_CHOICES,
  BG_REPEAT_CHOICES,
  BG_SIZE_CHOICES,
  DIMENSION_UNITS,
  FONT_FAMILIES,
  GRADIENT_ANGLE_BOUNDS,
  HEX_COLOR_PATTERN,
  LENGTH_UNITS,
  OVERLAY_OPACITY_BOUNDS,
  SAFE_IMAGE_URL_PATTERN,
  SHADOW_CHOICES,
  SIZE_UNITS,
  TRACKING_UNITS,
  type BackgroundValues,
  type BlockStyle,
  type BorderValues,
  type ColorChoice,
  type GradientValues,
  type Responsive,
  type ShadowChoice,
  type SizeValues,
  type SpacingValues,
  type TypographyValues,
  type VisibilityValues,
} from "./types";

/**
 * Style values → scoped CSS (plan 5.3–5.4). Every rule targets `[data-pb="<id>"]`
 * so the same block can repeat on a page. Base rules sit at the top, tablet
 * and mobile overrides go into their own media queries, letting the browser
 * cascade base → tablet → mobile (plan 5.4: "masaüstü → tablet → mobil").
 *
 * The compiler emits only validated shapes: numbers are formatted as-is and
 * units/colors come from whitelisted sets (types.ts), so no CSS injection is
 * possible through style values.
 */

/**
 * The site's own breakpoints (public/assets/css/site.css switches its layout
 * at 900px and 620px). Builder styles must change at the same widths, or a
 * page shows two layouts at once between them (plan 5.3).
 */
export const BREAKPOINT_WIDTHS = { tablet: 900, mobile: 620 } as const;

export const BREAKPOINTS = {
  tablet: `max-width: ${BREAKPOINT_WIDTHS.tablet}px`,
  mobile: `max-width: ${BREAKPOINT_WIDTHS.mobile}px`,
} as const;

export type DeviceKey = "base" | "tablet" | "mobile";

/** Editor viewports (plan 5.6), each inside its device's range; the style panel writes to the matching device. */
export const EDITOR_VIEWPORTS = [
  { device: "base", width: 1440, label: "Desktop", icon: "Monitor" },
  { device: "tablet", width: 768, label: "Tablet", icon: "Tablet" },
  { device: "mobile", width: 390, label: "Mobile", icon: "Smartphone" },
] as const;

function formatValue(value: number): string {
  // Strip floating point noise from panel input.
  return String(Number(value.toFixed(4)));
}

// ---------------------------------------------------------------------------
// Declaration builders per group
// ---------------------------------------------------------------------------

const fontCssByChoice = new Map(FONT_FAMILIES.map((entry) => [entry.key, entry.css]));

function colorCss(color: ColorChoice): string | null {
  if (color.source === "token") return `var(--${color.value})`;
  // The schema already guarantees hex, but the compiler never trusts raw data.
  return HEX_COLOR_PATTERN.test(color.value) ? color.value : null;
}

/** Whitelist check so an unvalidated value can never smuggle a string unit through. */
function safeUnit(unit: string, allowed: readonly string[]): boolean {
  return allowed.includes(unit);
}

function typographyDeclarations(values: Partial<TypographyValues> | undefined): string[] {
  if (!values) return [];
  const declarations: string[] = [];
  if (values.fontFamily && fontCssByChoice.has(values.fontFamily)) {
    declarations.push(`font-family:${fontCssByChoice.get(values.fontFamily)!}`);
  }
  if (values.fontSize && safeUnit(values.fontSize.unit, SIZE_UNITS)) {
    declarations.push(`font-size:${formatValue(values.fontSize.value)}${values.fontSize.unit}`);
  }
  if (values.fontWeight !== undefined) declarations.push(`font-weight:${values.fontWeight}`);
  if (values.lineHeight !== undefined) declarations.push(`line-height:${formatValue(values.lineHeight)}`);
  if (values.letterSpacing && safeUnit(values.letterSpacing.unit, TRACKING_UNITS)) {
    declarations.push(`letter-spacing:${formatValue(values.letterSpacing.value)}${values.letterSpacing.unit}`);
  }
  if (values.textAlign) declarations.push(`text-align:${values.textAlign}`);
  const color = values.textColor && colorCss(values.textColor);
  if (color) declarations.push(`color:${color}`);
  return declarations;
}

/** camelCase prop key → CSS property (`marginTop` → `margin-top`). */
function cssProperty(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Percent-encodes everything outside the URL-safe set so a stored value can
 * never break out of the quoted `url("…")` token or close the `<style>` raw
 * text element it is printed into (`<`, `>`, quotes, backslashes, controls).
 * Percent escapes are valid inside CSS url() tokens, so real URLs survive.
 */
function encodeCssUrl(url: string): string {
  return url.replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&*+,;=%]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).toUpperCase();
    return `%${code.padStart(2, "0")}`;
  });
}

function spacingDeclarations(values: Partial<SpacingValues> | undefined): string[] {
  if (!values) return [];
  const declarations: string[] = [];
  for (const [key, edge] of Object.entries(values)) {
    if (!edge) continue;
    if (!(LENGTH_UNITS as readonly string[]).includes(edge.unit)) continue;
    declarations.push(`${cssProperty(key)}:${formatValue(edge.value)}${edge.unit}`);
  }
  return declarations;
}

function backgroundDeclarations(values: Partial<BackgroundValues> | undefined): string[] {
  if (!values) return [];
  const declarations: string[] = [];
  const color = values.color && colorCss(values.color);
  if (color) declarations.push(`background-color:${color}`);

  // One `background-image` declaration carries every layer; in CSS the FIRST
  // layer paints on top, so the scrim sits over the photo and both sit over
  // the gradient.
  const layers: string[] = [];
  const overlay = overlayLayer(values.overlayColor, values.overlayOpacity);
  if (overlay) layers.push(overlay);
  if (values.image && SAFE_IMAGE_URL_PATTERN.test(values.image)) {
    layers.push(`url("${encodeCssUrl(values.image)}")`);
  }
  const gradient = gradientLayer(values.gradient);
  if (gradient) layers.push(gradient);
  if (layers.length) declarations.push(`background-image:${layers.join(",")}`);

  if (values.size && (BG_SIZE_CHOICES as readonly string[]).includes(values.size)) {
    declarations.push(`background-size:${values.size}`);
  }
  if (values.position && (BG_POSITION_CHOICES as readonly string[]).includes(values.position)) {
    declarations.push(`background-position:${values.position}`);
  }
  if (values.repeat && (BG_REPEAT_CHOICES as readonly string[]).includes(values.repeat)) {
    declarations.push(`background-repeat:${values.repeat}`);
  }
  return declarations;
}

/** Two-stop gradient from validated colors only; null when either color is unsafe. */
function gradientLayer(gradient: GradientValues | undefined): string | null {
  if (!gradient) return null;
  const from = colorCss(gradient.from);
  const to = colorCss(gradient.to);
  if (!from || !to) return null;
  const angle = Math.min(GRADIENT_ANGLE_BOUNDS.max, Math.max(GRADIENT_ANGLE_BOUNDS.min, gradient.angle));
  return `linear-gradient(${formatValue(angle)}deg,${from},${to})`;
}

/**
 * The scrim: a flat gradient of the overlay color at the chosen opacity.
 * `color-mix` carries the opacity because theme colors are `var(…)` tokens,
 * which no alpha format can express directly.
 */
function overlayLayer(color: ColorChoice | undefined, opacity: number | undefined): string | null {
  const css = color && colorCss(color);
  if (!css || !opacity || opacity <= OVERLAY_OPACITY_BOUNDS.min) return null;
  const percent = formatValue(
    Math.min(OVERLAY_OPACITY_BOUNDS.max, opacity) * 100,
  );
  const flat = `color-mix(in srgb,${css} ${percent}%,transparent)`;
  return `linear-gradient(${flat},${flat})`;
}

/** Fixed shadow values — presets only, so no free-form shadow string exists (plan 5.3). */
const SHADOW_CSS: Record<ShadowChoice, string> = {
  none: "none",
  sm: "0 1px 2px rgb(0 0 0 / 0.06)",
  md: "0 2px 8px rgb(0 0 0 / 0.1)",
  lg: "0 8px 24px rgb(0 0 0 / 0.14)",
  xl: "0 16px 48px rgb(0 0 0 / 0.2)",
};

function borderDeclarations(values: Partial<BorderValues> | undefined): string[] {
  if (!values) return [];
  const declarations: string[] = [];
  if (values.width && (LENGTH_UNITS as readonly string[]).includes(values.width.unit)) {
    declarations.push(`border-width:${formatValue(values.width.value)}${values.width.unit}`);
  }
  if (values.style && (BORDER_STYLES as readonly string[]).includes(values.style)) {
    declarations.push(`border-style:${values.style}`);
  }
  const color = values.color && colorCss(values.color);
  if (color) declarations.push(`border-color:${color}`);
  if (values.radius && (LENGTH_UNITS as readonly string[]).includes(values.radius.unit)) {
    declarations.push(`border-radius:${formatValue(values.radius.value)}${values.radius.unit}`);
  }
  if (values.shadow && values.shadow in SHADOW_CSS) {
    declarations.push(`box-shadow:${SHADOW_CSS[values.shadow]}`);
  }
  return declarations;
}

function sizeDeclarations(values: Partial<SizeValues> | undefined): string[] {
  if (!values) return [];
  const declarations: string[] = [];
  const entries = [
    ["width", values.width],
    ["max-width", values.maxWidth],
    ["min-width", values.minWidth],
    ["height", values.height],
    ["max-height", values.maxHeight],
    ["min-height", values.minHeight],
  ] as const;
  for (const [prop, dim] of entries) {
    if (!dim || !(DIMENSION_UNITS as readonly string[]).includes(dim.unit)) continue;
    declarations.push(`${prop}:${formatValue(dim.value)}${dim.unit}`);
  }
  return declarations;
}

/**
 * Visibility (plan 5.3): one disjoint screen band per device — desktop
 * (≥901px), tablet (621–900px), mobile (≤620px) — so a checked box never
 * fights another device's rule in the cascade.
 */
function visibilityRules(selector: string, visibility: VisibilityValues | undefined): string[] {
  if (!visibility) return [];
  const rules: string[] = [];
  const hide = `${selector}{display:none}`;
  if (visibility.desktop) rules.push(`@media (min-width: ${BREAKPOINT_WIDTHS.tablet + 1}px){${hide}}`);
  if (visibility.tablet) {
    rules.push(`@media (min-width: ${BREAKPOINT_WIDTHS.mobile + 1}px) and (max-width: ${BREAKPOINT_WIDTHS.tablet}px){${hide}}`);
  }
  if (visibility.mobile) rules.push(`@media (max-width: ${BREAKPOINT_WIDTHS.mobile}px){${hide}}`);
  return rules;
}

const GRID_TEMPLATES: Record<GridVariant, string> = {
  "2": "repeat(2, minmax(0, 1fr))",
  "3": "repeat(3, minmax(0, 1fr))",
  "4": "repeat(4, minmax(0, 1fr))",
  "1/3+2/3": "minmax(0, 1fr) minmax(0, 2fr)",
  "2/3+1/3": "minmax(0, 2fr) minmax(0, 1fr)",
  "1/4+3/4": "minmax(0, 1fr) minmax(0, 3fr)",
};

function blockDeclarations(block: BlockData): { base: string[]; tablet: string[]; mobile: string[] } {
  const style = (block.props as { style?: BlockStyle }).style;
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];

  // Grid layout values are structural, not element styling — they come with
  // the block props and must be emitted even when no style values exist.
  // Tablet/mobile column overrides go into their own media bands so the
  // browser cascade resolves base → tablet → mobile like every group.
  if (block.type === "GridBlock") {
    const props = block.props as {
      variant?: GridVariant;
      gap?: GridGap;
      columnsTablet?: GridVariant;
      columnsMobile?: GridVariant;
    };
    if (props.variant && GRID_VARIANTS.includes(props.variant)) {
      base.push(`grid-template-columns:${GRID_TEMPLATES[props.variant]}`);
    }
    if (props.gap && props.gap in GRID_GAP_VALUES) base.push(`gap:${GRID_GAP_VALUES[props.gap]}px`);
    if (props.columnsTablet && GRID_VARIANTS.includes(props.columnsTablet)) {
      tablet.push(`grid-template-columns:${GRID_TEMPLATES[props.columnsTablet]}`);
    }
    if (props.columnsMobile && GRID_VARIANTS.includes(props.columnsMobile)) {
      mobile.push(`grid-template-columns:${GRID_TEMPLATES[props.columnsMobile]}`);
    }
  }

  if (!style) return { base, tablet, mobile };
  pushResponsive(base, tablet, mobile, typographyDeclarations, style.typography);
  pushResponsive(base, tablet, mobile, spacingDeclarations, style.spacing);
  pushResponsive(base, tablet, mobile, backgroundDeclarations, style.background);
  pushResponsive(base, tablet, mobile, borderDeclarations, style.border);
  pushResponsive(base, tablet, mobile, sizeDeclarations, style.size);
  return { base, tablet, mobile };
}

function pushResponsive<T extends Record<string, unknown>>(
  base: string[],
  tablet: string[],
  mobile: string[],
  build: (values: Partial<T> | undefined) => string[],
  responsive: Responsive<T> | undefined,
): void {
  if (!responsive) return;
  if (responsive.base) base.push(...build(responsive.base));
  if (responsive.tablet) tablet.push(...build(responsive.tablet));
  if (responsive.mobile) mobile.push(...build(responsive.mobile));
}

// ---------------------------------------------------------------------------
// Document compiler
// ---------------------------------------------------------------------------

export function compileDocumentCss(data: PageBuilderData): string {
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  const visibilityRuleSet: string[] = [];

  walkBlocks(data, (block) => {
    const id = (block.props as { id?: unknown }).id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) return;
    const selector = `[data-pb="${id}"][data-pb]`;
    const { base, tablet, mobile } = blockDeclarations(block);
    if (base.length) baseRules.push(`${selector}{${base.join(";")}}`);
    if (tablet.length) tabletRules.push(`${selector}{${tablet.join(";")}}`);
    if (mobile.length) mobileRules.push(`${selector}{${mobile.join(";")}}`);
    visibilityRuleSet.push(...visibilityRules(selector, (block.props as { style?: BlockStyle }).style?.visibility));
  });

  return [
    baseRules.join("\n"),
    tabletRules.length ? `@media (${BREAKPOINTS.tablet}){${tabletRules.join("")}}` : "",
    mobileRules.length ? `@media (${BREAKPOINTS.mobile}){${mobileRules.join("")}}` : "",
    // Visibility rules are their own top-layer queries; last so they win.
    ...visibilityRuleSet,
  ]
    .filter(Boolean)
    .join("\n");
}
