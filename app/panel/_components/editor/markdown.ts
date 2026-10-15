import { marked } from "marked";

/*
 * Markdown paste support: plain-text clipboards that clearly carry markdown are
 * converted to the schema's nodes instead of landing as literal text. The
 * scoring is deliberately conservative — a lone `**word**` or one link stays
 * literal text, whole documents convert.
 */
const MD_SIGNALS: { pattern: RegExp; score: number }[] = [
  { pattern: /(^|\n) {0,3}(?:```|~~~)/, score: 3 }, // fenced code block
  { pattern: /(^|\n) {0,3}#{1,6} \S/, score: 3 }, // heading
  { pattern: /(^|\n) {0,3}> \S/, score: 2 }, // blockquote
  { pattern: /\*\*[^*\n]+\*\*|__[^_\n]+__/, score: 2 }, // bold
  { pattern: /\[[^\]\n]+\]\([^)\n]{4,}\)/, score: 2 }, // link
];

export function looksLikeMarkdown(text: string) {
  if (text.trim().length < 6) return false;
  let score = 0;
  for (const { pattern, score: value } of MD_SIGNALS) {
    if (pattern.test(text)) score += value;
  }
  if ((text.match(/(^|\n) {0,3}[-*+] \S/g) ?? []).length >= 2) score += 3; // bullet list
  if ((text.match(/(^|\n) {0,3}\d{1,9}[.)] \S/g) ?? []).length >= 2) score += 3; // ordered list
  return score >= 3;
}

/** Markdown → schema HTML; headings clamp to the levels the toolbar offers. */
export function markdownToHtml(text: string) {
  const html = marked.parse(text, { async: false }) as string;
  return html.replace(/<h([1-6])>/g, (_, level: string) => `<h${Math.min(4, Math.max(2, Number(level)))}>`);
}
