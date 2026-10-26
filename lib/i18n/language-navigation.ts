import { localizePath, splitLocale, type Locale } from "./config";

/** Account/auth URLs use ?lang=; public pages use a locale prefix. Keep all other context. */
export function languageHref(
  path: string,
  search: string,
  locale: Locale,
  routing: "query" | "path",
) {
  const params = new URLSearchParams(search);
  if (routing === "query") params.set("lang", locale);
  else params.delete("lang");
  const pathname =
    routing === "path" ? localizePath(splitLocale(path).path, locale) : path;
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
