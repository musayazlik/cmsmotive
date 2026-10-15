import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_HEADER, splitLocale } from "@/lib/i18n/config";

/**
 * Tells the root layout which site language the URL is in, so React pages
 * (the journal, status pages) render `<html lang>` correctly. Locale routing
 * itself lives in next.config.ts; the static-site pages set their own lang.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, splitLocale(request.nextUrl.pathname).locale);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Public pages only: the account area, auth flows, APIs and static files keep their own language.
  matcher: ["/((?!api|panel|auth|assets|legacy|_next|.*\\.[a-z0-9]+$).*)"],
};
