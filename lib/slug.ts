const CHAR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  ä: "a", Ä: "a", à: "a", á: "a", â: "a", è: "e", é: "e", ê: "e",
  ì: "i", í: "i", ò: "o", ó: "o", ô: "o", ù: "u", ú: "u", ß: "ss",
};

/** Diacritics-aware slug generator shared by the panel forms and the API. */
export function slugify(input: string): string {
  return input
    .split("")
    .map((char) => CHAR_MAP[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
