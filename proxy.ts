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
import { decidePagePath, listLegacyPageSlugs, type PagePathDecision } from "@/lib/page-builder/proxy-pages";
import { getStorePageRegistry, type StorePageRegistry } from "@/lib/page-builder/registry";

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

  // Draft previews (plan 5.7): never indexed, never cached, whatever the
  // token state is. The route itself decides session-or-token access.
  if (pathname === "/pb-preview" || pathname.startsWith("/pb-preview/")) {
    return privateResponse(NextResponse.next({ request: { headers } }));
  }

  // Direct requests to the internal legacy handler: today the beforeFiles
  // rewrite in next.config.ts blocked these; the proxy does the same now that
  // the builder's catch-all route makes rewrites the only entrance.
  if (pathname === "/legacy" || pathname.startsWith("/legacy/")) {
    return NextResponse.rewrite(new URL("/__not-found", request.nextUrl.origin), { request: { headers } });
  }

  // The builder page flow (plan 5.8): the catch-all route matches almost every
  // path, so the proxy decides the rewrite destination while nothing has
  // been rendered yet. A registry failure sends the request down the normal
  // flow instead of erroring a public URL.
  if (request.method === "GET" || request.method === "HEAD") {
    const cleanPath = pathname.replace(/\/+$/, "") || "/";
    const decision = await pagePathDecision(request, cleanPath);
    if (decision.action === "rewrite") {
      const destination = request.nextUrl.clone();
      destination.pathname = decision.destination;
      headers.set(LOCALE_HEADER, decision.locale);
      const response = NextResponse.rewrite(destination, { request: { headers } });
      // Builder pages answer with the same headers the legacy route sets
      // (plan 5.9): the response language, cache splitting on cookies and —
      // for signed-in visitors — a shared-cache ban.
      if (decision.builder) {
        response.headers.set("Content-Language", decision.locale);
        response.headers.set("Vary", "Cookie");
        if (await hasPanelSessionFor(request.headers)) response.headers.set("Cache-Control", "private, no-store");
      }
      return response;
    }
    if (decision.action === "redirect") {
      const destination = request.nextUrl.clone();
      destination.pathname = decision.destination;
      return NextResponse.redirect(destination, decision.permanent ? 301 : 302);
    }
  }

  headers.set(LOCALE_HEADER, splitLocale(request.nextUrl.pathname).locale);
  return NextResponse.next({ request: { headers } });
}

/**
 * Builder pages plus the legacy flow (plan 5.8). `decidePagePath` says what a
 * page path becomes; every query hits the short-TTL registry instead of the
 * database per request. A registry failure must not take public URLs down:
 * decidePagePath then runs against an empty registry, which still rewrites the
 * React and legacy routes below — only builder pages go missing.
 */
const EMPTY_REGISTRY: StorePageRegistry = { pages: [], redirects: [] };
let legacySlugsCache: Set<string> | null = null;
async function pagePathDecision(request: NextRequest, pathname: string): Promise<PagePathDecision> {
  const UNTOUCHED: PagePathDecision = { action: "untouched" };
  try {
    const match = await resolveRequestStore(request);
    if (!legacySlugsCache) legacySlugsCache = listLegacyPageSlugs();
    const registry = await getStorePageRegistry(match.store.id).catch(() => EMPTY_REGISTRY);
    return decidePagePath({
      pathname,
      method: request.method,
      store: { defaultLocale: match.store.defaultLocale, locales: match.store.locales },
      registry,
      legacySlugs: legacySlugsCache,
    });
  } catch {
    return UNTOUCHED;
  }
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
  // `/legacy/*` stays covered so direct requests hit the proxy's 404 rewrite.
  matcher: ["/((?!api(?:/|$)|assets(?:/|$)|_next(?:/|$)|.*\\.[a-z0-9]+$).*)", "/wp-login.php"],
};
