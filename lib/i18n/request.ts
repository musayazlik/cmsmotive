import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER, isLocale, type Locale } from "./config";

/**
 * The site language of the current request, as proxy.ts saw it in the URL.
 * For components that get no route params (loading and not-found boundaries).
 */
export async function getRequestLocale(): Promise<Locale> {
  const locale = (await headers()).get(LOCALE_HEADER);
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
