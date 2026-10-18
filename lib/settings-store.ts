import { prisma } from "@/lib/prisma";

/**
 * Generic access to a group of settings in the Setting table. Each field of
 * a group is one row, `<prefix>.<field>`, holding the JSON-encoded value, so
 * a group is declared by its defaults alone (see lib/*-settings-shared.ts).
 * Values are validated before they are written; on read, a missing row or a
 * value of the wrong type falls back to the field's default.
 */

type Json = string | number | boolean | null | string[];
export type SettingsGroup = Record<string, Json>;

function sameShape(value: unknown, fallback: Json): boolean {
  if (Array.isArray(fallback)) return Array.isArray(value) && value.every((item) => typeof item === "string");
  if (fallback === null) return value === null || typeof value === "string";
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
