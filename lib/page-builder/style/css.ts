import { walkBlocks, type BlockData, type PageBuilderData } from "../data";
import { ID_PATTERN } from "../ids";
import { GRID_VARIANTS, GRID_GAP_VALUES, type GridVariant, type GridGap } from "../blocks/grid/schema";
import {
  FONT_FAMILIES,
  HEX_COLOR_PATTERN,
  LENGTH_UNITS,
  SIZE_UNITS,
  TRACKING_UNITS,
  type BlockStyle,
  type ColorChoice,
  type Responsive,
  type SpacingValues,
  type TypographyValues,
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
  if (block.type === "GridBlock") {
    const props = block.props as { variant?: GridVariant; gap?: GridGap };
    if (props.variant && GRID_VARIANTS.includes(props.variant)) {
      base.push(`grid-template-columns:${GRID_TEMPLATES[props.variant]}`);
    }
    if (props.gap && props.gap in GRID_GAP_VALUES) base.push(`gap:${GRID_GAP_VALUES[props.gap]}px`);
  }

  if (!style) return { base, tablet, mobile };
  pushResponsive(base, tablet, mobile, typographyDeclarations, style.typography);
  pushResponsive(base, tablet, mobile, spacingDeclarations, style.spacing);
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

  walkBlocks(data, (block) => {
    const id = (block.props as { id?: unknown }).id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) return;
    const selector = `[data-pb="${id}"]`;
    const { base, tablet, mobile } = blockDeclarations(block);
    if (base.length) baseRules.push(`${selector}{${base.join(";")}}`);
    if (tablet.length) tabletRules.push(`${selector}{${tablet.join(";")}}`);
    if (mobile.length) mobileRules.push(`${selector}{${mobile.join(";")}}`);
  });

  return [
    baseRules.join("\n"),
    tabletRules.length ? `@media (${BREAKPOINTS.tablet}){${tabletRules.join("")}}` : "",
    mobileRules.length ? `@media (${BREAKPOINTS.mobile}){${mobileRules.join("")}}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
