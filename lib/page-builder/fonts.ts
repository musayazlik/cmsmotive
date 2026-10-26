import FONT_PRELOADS from "../font-preloads.json";
import { walkBlocks, type PageBuilderData } from "./data";
import { FONT_FAMILIES, type BlockStyle, type FontFamilyChoice } from "./style/types";

/**
 * Used-font files for one document (plan 5.5). Styles carry family choices
 * ("sans"/"mono"); the page preloads the matching self-hosted woff2 files —
 * with font-display: optional a font that is not preloaded may never paint.
 * The site's body already runs on Manrope, so that family is always kept,
 * additional families are added when a block references them.
 */

const FAMILY_PREFIXES: Record<FontFamilyChoice, string> = { sans: "manrope", mono: "dm-mono" };

function familyOf(file: string): FontFamilyChoice | null {
  const match = file.match(/\/assets\/fonts\/([a-z0-9-]+)-[0-9]+-/);
  if (!match) return null;
  const entry = (FONT_FAMILIES as ReadonlyArray<{ key: FontFamilyChoice; css: string }>).find(
    (candidate) => FAMILY_PREFIXES[candidate.key] === match[1],
  );
  return entry?.key ?? null;
}

export function usedFontFiles(data: PageBuilderData): string[] {
  const wanted = new Set<FontFamilyChoice>(["sans"]);
  walkBlocks(data, (block) => {
    const style = (block.props as { style?: BlockStyle }).style;
    for (const values of [style?.typography?.base, style?.typography?.tablet, style?.typography?.mobile]) {
      if (values?.fontFamily) wanted.add(values.fontFamily);
    }
  });
  const families = new Set([...wanted].map((key) => FAMILY_PREFIXES[key]));
  return (FONT_PRELOADS as readonly string[]).filter((file) => {
    const family = familyOf(file);
    return family !== null && families.has(FAMILY_PREFIXES[family]);
  });
}
