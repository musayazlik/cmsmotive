import sanitizeHtml from "sanitize-html";
import { walkBlocks } from "./data";

/**
 * Server-only rich text cleaner (plan 5.13). Puck's `<Render>` prints a
 * richtext value as stored, without any filtering (verified in Faz 0: an
 * `onerror` attribute and a `<script>` came out untouched). So every document
 * goes through this cleaner on every write and again before every render
 * (lib/page-builder/document.ts); nothing else may hand a document to
 * `<Render>`.
 *
 * Kept on purpose:
 * - `lang` on text elements, validated as a BCP 47 tag, so a phrase in another
 *   language stays marked for screen readers and search engines (decision 2,
 *   WCAG 3.1.2);
 * - headings H2–H4 only: the page's single H1 is a Heading block, so rich
 *   text H1 becomes H2 and H5/H6 become H4 (text is never lost).
 */

/** BCP 47 language tag: primary subtag plus optional region/script/variant subtags. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

const LANG_TAGS = [
  "p", "span", "blockquote", "li", "h2", "h3", "h4", "strong", "em", "b", "i", "u",
  "a", "figcaption", "td", "th", "caption", "summary", "q", "cite", "mark", "small", "pre", "code",
];

/** Drops a `lang` value that is not a language tag; keeps every other allowed attribute. */
function withValidLang(attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  if (attribs.lang === undefined || LANGUAGE_TAG.test(attribs.lang)) return attribs;
  const rest = { ...attribs };
  delete rest.lang;
  return rest;
}

const renameTo =
  (tagName: string): sanitizeHtml.Transformer =>
  (_name, attribs) => ({ tagName, attribs: withValidLang(attribs) });

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // Text structure
    "p", "br", "hr", "blockquote", "pre", "code",
    "h2", "h3", "h4",
    "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "small", "q", "cite",
    "sub", "sup", "span", "div",
    // Lists and tables (Tiptap ships both in the blog editor)
    "ul", "ol", "li",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    // Figures and links
    "a", "img", "figure", "figcaption",
    "details", "summary",
  ],
  allowedAttributes: {
    ...Object.fromEntries(LANG_TAGS.map((tag) => [tag, ["lang"]])),
    a: ["href", "name", "target", "rel", "title", "lang"],
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope", "align", "lang"],
    td: ["colspan", "rowspan", "align", "lang"],
    col: ["span", "width", "align"],
  },
  /**
   * Relative paths and anchors pass through (no scheme). In prose only https,
   * mail and phone links are acceptable; `javascript:`, `data:` and
   * protocol-relative URLs are removed.
   */
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  /** No inline styles or classes: styling belongs to the style panel. */
  allowedStyles: {},
  disallowedTagsMode: "discard",
  transformTags: {
    // A tag-specific transform replaces the "*" one, so each validates lang itself.
    "*": (tagName, attribs) => ({ tagName, attribs: withValidLang(attribs) }),
    // Copied links can never leave the page without rel enforcement.
    a: (_name, attribs) => ({ tagName: "a", attribs: { ...withValidLang(attribs), rel: "noopener noreferrer" } }),
    h1: renameTo("h2"),
    h5: renameTo("h4"),
    h6: renameTo("h4"),
    center: renameTo("p"),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** Cleans every richtext value of a validated document in place. */
export function sanitizeDocumentContent(document: { content?: unknown[] }): void {
  walkBlocks(document as Parameters<typeof walkBlocks>[0], (block) => {
    if (block.type !== "TextBlock") return;
    const props = (block.props ?? {}) as { content?: unknown };
    if (typeof props.content === "string") {
      props.content = sanitizeRichText(props.content);
    }
  });
}
