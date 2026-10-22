import { prisma } from "@/lib/prisma";

/**
 * Generic access to a group of settings in the Setting table. Each field of
 * a group is one row, `<prefix>.<field>`, holding the JSON-encoded value, so
 * a group is declared by its defaults alone (see lib/*-settings-shared.ts).
 * Values are validated before they are written; on read, a missing row or a
 * value of the wrong type falls back to the field's default.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type SettingsGroup = Record<string, Json>;

function sameShape(value: unknown, fallback: Json): boolean {
  if (Array.isArray(fallback)) {
    // A non-empty string default pins the items to strings (path lists,
    // profile URLs); an empty default may hold either strings or plain
    // objects (custom meta tags), but never a mixture.
    if (!Array.isArray(value)) return false;
    if (fallback.length && typeof fallback[0] === "string") return value.every((item) => typeof item === "string");
    const kinds = new Set(value.map((item) => (Array.isArray(item) ? "array" : item === null ? "null" : typeof item)));
    return kinds.size === 1 && (kinds.has("string") || kinds.has("object"));
  }
  if (fallback === null) return value === null || typeof value === "string";
  if (typeof fallback === "object" && fallback !== null) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return typeof value === typeof fallback;
}

export async function readSettingsGroup<T extends SettingsGroup>(prefix: string, defaults: T): Promise<T> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: `${prefix}.` } } });
    const values = new Map(rows.map((row) => [row.key.slice(prefix.length + 1), row.value]));
    const result = { ...defaults };
    for (const field of Object.keys(defaults) as (keyof T & string)[]) {
      const raw = values.get(field);
      if (raw === undefined) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (sameShape(parsed, defaults[field])) result[field] = parsed as T[typeof field];
      } catch {
        // A hand-edited row that is not JSON keeps the default.
      }
    }
    return result;
  } catch {
    return defaults;
  }
}

export async function writeSettingsGroup<T extends SettingsGroup>(prefix: string, values: T): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([field, value]) => {
      const key = `${prefix}.${field}`;
      const encoded = JSON.stringify(value);
      return prisma.setting.upsert({ where: { key }, update: { value: encoded }, create: { key, value: encoded } });
    }),
  );
}
