import type { Data } from "@puckeditor/core";
import { walkBlocks } from "./data";

/**
 * AI translation of a page document (Faz 4). Pure walker: the caller supplies
 * the actual translator, so the string collection stays testable offline and
 * the model call lives in the server action.
 *
 * Only whitelisted display-text props are sent — layout variants, image urls,
 * icon names and inline styles never leave the store.
 */

const TEXT_KEYS = new Set([
  "title",
  "subtitle",
  "kicker",
  "text",
  "content", // richtext (HTML); the prompt says to keep tags intact
  "question",
  "answer",
  "description",
  "quote",
  "buttonText",
  "secondaryText",
  "privacyNote",
  "alt",
  "label",
]);

/** Technical strings the model must never see or rewrite. */
const isTechnical = (value: string) =>
  !value.trim() ||
  value.length > 5000 ||
  /^(https?:)?\/\//i.test(value) ||
  value.startsWith("/") ||
  value.startsWith("r2://") ||
  value.startsWith("data:");

type Entry = { value: string; set: (next: string) => void };

function collectStrings(block: { type: string; props: Record<string, unknown> }, entries: Entry[]): void {
  const visit = (key: string, value: unknown, set: (next: never) => void): void => {
    if (TEXT_KEYS.has(key) && typeof value === "string" && !isTechnical(value)) {
      entries.push({ value, set: set as (next: string) => void });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) =>
        visit(key, item, (next: unknown) => {
          (value as unknown[])[index] = next;
        }),
      );
    } else if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(childKey, childValue, (next: unknown) => {
          (value as Record<string, unknown>)[childKey] = next;
        });
      }
    }
  };
  for (const [key, value] of Object.entries(block.props)) {
    visit(key, value, (next: unknown) => {
      block.props[key] = next;
    });
  }
}

export type TranslationPart = { translations: string[] };

/**
 * Translates every whitelisted string with `translate` (which receives the
 * unique values and must return them, same order). Values that repeat are
 * translated once and written back everywhere.
 */
export async function translateDocument<T extends Data>(
  document: T,
  language: string,
  translate: (values: string[], language: string) => Promise<string[]>,
): Promise<T> {
  const cloned = JSON.parse(JSON.stringify(document)) as T;
  const entries: Entry[] = [];
  walkBlocks(cloned, (block) => collectStrings(block as never, entries));

  const unique = [...new Set(entries.map((entry) => entry.value))];
  if (unique.length === 0) return cloned;
  const translated = await translate(unique, language);
  if (!Array.isArray(translated) || translated.length !== unique.length) {
    throw new Error("The translation has the wrong length — the page was left unchanged.");
  }
  const map = new Map(unique.map((value, index) => [value, translated[index]]));
  for (const entry of entries) entry.set(map.get(entry.value) ?? entry.value);
  return cloned;
}
