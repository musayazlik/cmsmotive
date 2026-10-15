/**
 * A small HTML walker for the prerendered static-site pages: it visits every
 * translatable text node and attribute value and lets the caller swap it.
 * Keys are the source text with whitespace collapsed, exactly as written in
 * the HTML (entities such as `&amp;` stay encoded). Code, scripts, styles and
 * inline SVG are left alone, as is text with no letters in it.
 */

/** Elements whose content is never translated. `script`/`style` are raw text and skipped wholesale. */
const RAW_TEXT = new Set(["script", "style"]);
const SKIP_CONTENT = new Set(["pre", "code", "svg", "textarea"]);

/** Attributes that carry human-readable text. */
const TEXT_ATTRIBUTES = new Set(["alt", "aria-label", "placeholder", "title"]);
/** `<meta>` tags whose `content` is user-facing copy. */
const TEXT_META = /\b(?:name=["'](?:description|twitter:title|twitter:description)["']|property=["']og:(?:title|description)["'])/i;

const LETTER = /\p{L}/u;

export type Translate = (key: string) => string | undefined;

export function normalizeKey(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function swapText(text: string, translate: Translate) {
  const key = normalizeKey(text);
  if (!key || !LETTER.test(key)) return text;
  const translated = translate(key);
  if (translated === undefined) return text;
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  return `${lead}${translated}${trail}`;
}

function swapAttributes(tag: string, name: string, translate: Translate) {
  const metaCopy = name === "meta" && TEXT_META.test(tag);
  return tag.replace(/(\s)([a-zA-Z-:]+)=(["'])(.*?)\3/g, (match, space: string, attribute: string, quote: string, value: string) => {
    const lower = attribute.toLowerCase();
    if (!TEXT_ATTRIBUTES.has(lower) && !(metaCopy && lower === "content")) return match;
    return `${space}${attribute}=${quote}${swapText(value, translate)}${quote}`;
  });
}

/** Rewrites every translatable string in `html` through `translate` (undefined keeps the original). */
export function translateHtml(html: string, translate: Translate): string {
  let out = "";
  let i = 0;
  let skipDepth = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const textEnd = lt < 0 ? html.length : lt;
    if (textEnd > i) {
      const text = html.slice(i, textEnd);
      out += skipDepth > 0 ? text : swapText(text, translate);
    }
    if (lt < 0) break;

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end < 0 ? html.length : end + 3;
      out += html.slice(lt, stop);
      i = stop;
      continue;
    }

    // Scan to the closing `>` of the tag, ignoring any inside quoted attribute values.
    let j = lt + 1;
    let quote = "";
    while (j < html.length) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        break;
      }
      j++;
    }
    const tag = html.slice(lt, j + 1);
    i = j + 1;

    const nameMatch = tag.match(/^<\/?([a-zA-Z][\w:-]*)/);
    if (!nameMatch) {
      out += tag; // doctype, stray `<`
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    const closing = tag.startsWith("</");
    const selfClosing = tag.endsWith("/>");

    if (closing) {
      if (SKIP_CONTENT.has(name) && skipDepth > 0) skipDepth--;
      out += tag;
      continue;
    }

    out += skipDepth > 0 ? tag : swapAttributes(tag, name, translate);

    if (RAW_TEXT.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, i);
      const stop = end < 0 ? html.length : end;
      out += html.slice(i, stop);
      i = stop;
    } else if (SKIP_CONTENT.has(name) && !selfClosing) {
      skipDepth++;
    }
  }
  return out;
}

/** Every translatable key in `html`, in document order (duplicates included). */
export function collectKeys(html: string): string[] {
  const keys: string[] = [];
  translateHtml(html, (key) => {
    keys.push(key);
    return undefined;
  });
  return keys;
}
