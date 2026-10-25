import { prisma } from "@/lib/prisma";

/**
 * Generic access to a store's group of settings in the StoreSetting table.
 * Each field of a group is one row, `<prefix>.<field>`, holding the
 * JSON-encoded value, so a group is declared by its defaults alone (see
 * lib/*-settings-shared.ts). Every store keeps its own values.
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

export async function readSettingsGroup<T extends SettingsGroup>(storeId: string, prefix: string, defaults: T): Promise<T> {
  try {
    const rows = await prisma.storeSetting.findMany({ where: { storeId, key: { startsWith: `${prefix}.` } } });
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

export async function writeSettingsGroup<T extends SettingsGroup>(storeId: string, prefix: string, values: T): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([field, value]) => upsertStoreValue(storeId, `${prefix}.${field}`, JSON.stringify(value))),
  );
}

/** Raw string values of a store's settings rows, for modules that keep their own encoding. */
export async function readStoreValues(storeId: string, keys: string[]): Promise<Map<string, string>> {
  const rows = await prisma.storeSetting.findMany({ where: { storeId, key: { in: keys } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

/** Upsert of one raw store setting; usable inside a transaction. */
export function upsertStoreValue(storeId: string, key: string, value: string) {
  return prisma.storeSetting.upsert({ where: { storeId_key: { storeId, key } }, update: { value }, create: { storeId, key, value } });
}
