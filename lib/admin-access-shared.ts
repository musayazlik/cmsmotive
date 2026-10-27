/** Client-safe paths. The custom entry reduces discovery; sessions and roles still authorize every operation. */
export type AdminAccessSettings = { panelPath: string };

export const DEFAULT_ADMIN_ACCESS_SETTINGS: AdminAccessSettings = { panelPath: "/panel" };
const RESERVED_PATHS = new Set([
  "account", "newsletter",
  "api", "auth", "assets", "legacy", "en", "de", "tr", "blog", "theme", "extension",
  "themes", "extensions", "docs", "pricing", "contact", "about", "privacy", "terms",
  "imprint", "status", "robots", "sitemap", "maintenance", "index", "cookies", "loading",
  "blog-accessibility", "blog-composer", "blog-typography", "demo-nordform", "headless",
]);

export function validateAdminAccessSettings(input: Record<string, unknown>): { data: AdminAccessSettings } | { error: string } {
  const raw = typeof input.panelPath === "string" ? input.panelPath.trim().toLowerCase() : "";
  const panelPath = raw.startsWith("/") ? raw : `/${raw}`;
  if (!/^\/[a-z][a-z0-9-]{2,63}$/.test(panelPath)) {
    return { error: "Use a single path of 3–64 lowercase letters, numbers or hyphens, starting with a letter." };
  }
  if (RESERVED_PATHS.has(panelPath.slice(1))) return { error: "This address is already used by the public site. Choose another path." };
  return { data: { panelPath } };
}

export function panelHref(href: string, basePath: string): string {
  return /^\/panel(?=\/|\?|#|$)/.test(href) ? `${basePath}${href.slice(6)}` : href;
}

export function internalPanelPath(pathname: string, basePath: string): string {
  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) return `/panel${pathname.slice(basePath.length)}`;
  return pathname;
}

export function adminLoginPath(basePath: string): string {
  return basePath === "/panel" ? "/auth/sign-in" : `${basePath}/login`;
}
