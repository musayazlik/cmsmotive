import sanitizeHtml from "sanitize-html";
import { walkBlocks, type PageBuilderData } from "./data";
import type { HeadingLevel } from "./blocks/heading/schema";
import type { BlockStyle } from "./style/types";

/** Publish-time structural blockers and advisory typography checks (plan 5.11). */
const HEADING_INDEX: Record<HeadingLevel, number> = { h1: 1, h2: 2, h3: 3, h4: 4 };
export type A11yAudit = { blockers: string[]; warnings: string[] };

function plainText(value: unknown): string {
  return typeof value === "string"
    ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|&#160;/gi, " ").trim()
    : "";
}

export function auditDocumentA11y(data: PageBuilderData): A11yAudit {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const headings: number[] = [];
  let h1Count = 0;

  function heading(level: number, text?: unknown) {
    if (level === 1) h1Count++;
    headings.push(level);
    if (text !== undefined && !plainText(text)) warnings.push("A heading has no text.");
  }

  walkBlocks(data, (block) => {
    const props = (block.props ?? {}) as Record<string, unknown>;
    // Check every block, including headings/buttons/images, before type-specific checks.
    const style = props.style as BlockStyle | undefined;
    const typography = style?.typography;
    for (const [device, values] of Object.entries(typography ?? {})) {
      const fontSize = values?.fontSize;
      if (!fontSize) continue;
      if (fontSize.unit === "px" && fontSize.value < 12) warnings.push(`A text is smaller than 12 px (${device}).`);
      if (fontSize.unit === "rem" && fontSize.value < 0.75) warnings.push(`A text is smaller than 0.75rem (${device}).`);
    }
    const visibility = style?.visibility;
    if (visibility?.desktop && visibility.tablet && visibility.mobile) {
      warnings.push("A block is hidden on every device; delete it instead of leaving it in the page.");
    }
    if (block.type === "HeadingBlock") {
      heading(HEADING_INDEX[(props.level as HeadingLevel) ?? "h2"] ?? 2, props.text);
    }
    // The hero renders its title as the page H1; it counts in the outline too.
    if (block.type === "HeroBlock" && plainText(props.title)) {
      heading(1, props.title);
    }
    if (block.type === "ImageBlock" && props.decorative !== true && !plainText(props.alt)) {
      blockers.push("An image has no alternative text. Set alt text or mark it decorative.");
    }
    if (block.type === "ButtonBlock" && !plainText(props.text)) blockers.push("A button has no label.");
    if (block.type === "TextBlock" && typeof props.content === "string") {
      // Rich text participates in the same heading sequence and image-alt rules.
      // Use the HTML parser, not regex: attributes/text may contain angle brackets.
      sanitizeHtml(props.content, {
        allowedTags: false,
        allowedAttributes: false,
        transformTags: {
          "*": (tagName, attribs) => {
            if (/^h[1-6]$/.test(tagName)) heading(Number(tagName[1]));
            if (tagName === "img" && !plainText(attribs.alt) && attribs.alt !== "") {
              blockers.push("An image has no alternative text. Set alt text or mark it decorative.");
            }
            return { tagName, attribs };
          },
        },
      });
    }
  });

  if (h1Count === 0) blockers.push("Add exactly one page title (H1).");
  else if (h1Count > 1) blockers.push(`The page has ${h1Count} H1 titles; keep exactly one.`);
  if (headings[0] !== undefined && headings[0] !== 1) {
    blockers.push("Start the heading outline with the page title (H1).");
  }
  for (let index = 1; index < headings.length; index++) {
    if (headings[index] > headings[index - 1] + 1) {
      blockers.push("The heading order skips a level (e.g. H2 followed by H4).");
      break;
    }
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}
