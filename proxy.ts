import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_HEADER, splitLocale } from "@/lib/i18n/config";
import { isLocale } from "@/lib/i18n/config";
import { getLegalSettings } from "@/lib/legal";
import { maintenancePage } from "@/lib/maintenance-page";
import { DEFAULT_MAINTENANCE_SETTINGS, type MaintenanceSettings } from "@/lib/maintenance-settings-shared";
import { hasPanelSessionFor } from "@/lib/public-session";
import { readSettingsGroup } from "@/lib/settings-store";
import { resolveRequestStore } from "@/lib/stores";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { ADMIN_ENTRY_COOKIE, ADMIN_ENTRY_TTL, issueAdminEntry } from "@/lib/admin-entry";

const ADMIN_CONTEXT_HEADER = "x-admin-gateway";
// Account pages reachable through the private entry; the historical /login
// suffix maps onto /auth/sign-in (sign-up is never private).
const PRIVATE_AUTH_MODES = new Set(["sign-in", "forgot-password", "reset-password", "verify-email"]);

function privateAuthRoute(suffix: string): string | null {
  const mode = suffix === "login" ? "sign-in" : suffix;
  return PRIVATE_AUTH_MODES.has(mode) ? `/auth/${mode}` : null;
}

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Hide private paths while preserving Origin on the store-switch POST.
  response.headers.set("Referrer-Policy", "strict-origin");
  return response;
}

/**
 * Resolve the private admin entry first, then localize public pages and apply
 * maintenance mode. Security configuration fails closed; the maintenance
 * setting alone fails open. API routes keep their own session/role guards.
 */
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Only this proxy may assert that a request arrived through the configured entry.
  headers.delete(ADMIN_CONTEXT_HEADER);
  let panelPath: string;
  let pathname: string;
  try {
    ({ panelPath } = await getAdminAccessSettings());
    pathname = decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return new NextResponse("Temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const isPanel = pathname === "/panel" || pathname.startsWith("/panel/");
  if (panelPath !== "/panel" && isPanel) return privateResponse(new NextResponse("Not found.", { status: 404 }));
  if (panelPath !== "/panel" && (pathname === panelPath || pathname.startsWith(`${panelPath}/`))) {
    const suffix = pathname.slice(panelPath.length);
    const mode = suffix.slice(1);
    const authRoute = privateAuthRoute(mode);
    const destination = request.nextUrl.clone();
    destination.pathname = authRoute ?? `/panel${suffix}`;
    headers.set(ADMIN_CONTEXT_HEADER, panelPath);
    headers.set(LOCALE_HEADER, isLocale(request.nextUrl.searchParams.get("lang")) ? request.nextUrl.searchParams.get("lang")! : "de");
    const response = privateResponse(NextResponse.rewrite(destination, { request: { headers } }));
    if (authRoute && (request.method === "GET" || request.method === "HEAD")) {
      response.cookies.set(ADMIN_ENTRY_COOKIE, issueAdminEntry(panelPath), {
        httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
        path: "/", maxAge: ADMIN_ENTRY_TTL,
      });
    }
    return response;
  }
  if (/^\/(admin|administrator|wp-admin)(\/|$)/.test(pathname) || pathname === "/wp-login.php") {
    return privateResponse(new NextResponse("Not found.", { status: 404 }));
  }
  if (isPanel || pathname === "/account" || pathname.startsWith("/account/") || pathname.startsWith("/newsletter/") || pathname === "/auth" || pathname.startsWith("/auth/")) {
    const lang=request.nextUrl.searchParams.get("lang");
    headers.set(LOCALE_HEADER, isPanel ? "en" : isLocale(lang)?lang:"de");
    return privateResponse(NextResponse.next({ request: { headers } }));
  }
  const maintenance = await maintenanceResponse(request);
  if (maintenance) return maintenance;

  headers.set(LOCALE_HEADER, splitLocale(request.nextUrl.pathname).locale);
  return NextResponse.next({ request: { headers } });
}

/** Public visitors, including regular members, see the store's maintenance page; administrators may review the live site. */
async function maintenanceResponse(request: NextRequest): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  // Legal information stays reachable while collecting reopening notifications.
  if (/^\/(imprint|privacy|terms|cookies)$/.test(splitLocale(request.nextUrl.pathname).path)) return null;

  let settings: MaintenanceSettings;
  let storeId: string;
  try {
    storeId = (await resolveRequestStore(request)).store.id;
    settings = await readSettingsGroup(storeId, "maintenance", DEFAULT_MAINTENANCE_SETTINGS);
  } catch {
    return null;
  }
  if (!settings.enabled) return null;
  // Signed-in panel accounts keep browsing the public site (fail-open: the
  // session check reports false rather than blocking anyone).
  if (await hasPanelSessionFor(request.headers)) return null;

  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "120",
  };
  // Client-side prefetches and router fetches cannot render HTML; a 503 body
  // they cannot parse sends the browser to a full reload, which then lands
  // on the maintenance page.
  if (request.headers.get("RSC") === "1" || request.headers.get("x-nextjs-data")) {
    return NextResponse.json({ maintenance: true }, { status: 503, headers });
  }
  return new Response(maintenancePage(settings, splitLocale(request.nextUrl.pathname).locale, { privacyVersion: (await getLegalSettings(storeId)).privacyVersion }), {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Public pages only: the account area, auth flows, APIs and static files keep their own language.
  matcher: ["/((?!api(?:/|$)|assets(?:/|$)|legacy(?:/|$)|_next(?:/|$)|.*\\.[a-z0-9]+$).*)", "/wp-login.php"],
};
