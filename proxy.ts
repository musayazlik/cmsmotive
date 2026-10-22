import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_HEADER, splitLocale } from "@/lib/i18n/config";
import { maintenancePage } from "@/lib/maintenance-page";
import { DEFAULT_MAINTENANCE_SETTINGS, type MaintenanceSettings } from "@/lib/maintenance-settings-shared";
import { hasPanelSessionFor } from "@/lib/public-session";
import { readSettingsGroup } from "@/lib/settings-store";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { ADMIN_ENTRY_COOKIE, ADMIN_ENTRY_TTL, issueAdminEntry } from "@/lib/admin-entry";

const ADMIN_CONTEXT_HEADER = "x-admin-gateway";
const PRIVATE_AUTH_MODES = new Set(["login", "forgot-password", "reset-password", "verify-email"]);

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
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
    const destination = request.nextUrl.clone();
    destination.pathname = PRIVATE_AUTH_MODES.has(mode) ? `/auth/${mode}` : `/panel${suffix}`;
    headers.set(ADMIN_CONTEXT_HEADER, panelPath);
    headers.set(LOCALE_HEADER, "en");
    const response = privateResponse(NextResponse.rewrite(destination, { request: { headers } }));
    if (PRIVATE_AUTH_MODES.has(mode) && (request.method === "GET" || request.method === "HEAD")) {
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
  if (isPanel || pathname === "/auth" || pathname.startsWith("/auth/")) {
    headers.set(LOCALE_HEADER, "en");
    return privateResponse(NextResponse.next({ request: { headers } }));
  }
  const maintenance = await maintenanceResponse(request);
  if (maintenance) return maintenance;

  headers.set(LOCALE_HEADER, splitLocale(request.nextUrl.pathname).locale);
  return NextResponse.next({ request: { headers } });
}

/** Public visitors, including regular members, see maintenance; administrators may review the live site. */
async function maintenanceResponse(request: NextRequest): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  let settings: MaintenanceSettings;
  try {
    settings = await readSettingsGroup("maintenance", DEFAULT_MAINTENANCE_SETTINGS);
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
  return new Response(maintenancePage(settings, splitLocale(request.nextUrl.pathname).locale), {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Public pages only: the account area, auth flows, APIs and static files keep their own language.
  matcher: ["/((?!api(?:/|$)|assets(?:/|$)|legacy(?:/|$)|_next(?:/|$)|.*\\.[a-z0-9]+$).*)", "/wp-login.php"],
};
