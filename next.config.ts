import type { NextConfig } from "next";

/**
 * Legacy static-site pages are served through the proxy's rewrite map
 * (lib/page-builder/proxy-pages.ts) since the page builder's catch-all route
 * took over page-path matching. Only the redirects below stay in config.
 *
 * Site languages (lib/i18n/config.ts): German at unprefixed URLs, English and
 * Turkish under `/en` and `/tr`. Every public page resolves to a handler that
 * receives the locale as its first segment.
 */
const prefixedLocales = "en|tr";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  turbopack: {
    // `import html from "@/static-site/404.html"` yields the file as a string.
    rules: { "*.html": { loaders: ["raw-loader"], as: "*.js" } },
  },
  outputFileTracingIncludes: {
    "/*": ["./static-site/**/*.html", "./i18n/**/*.json"],
  },
  async headers() {
    return [
      // Font file names carry a content hash (scripts/fonts/build-fonts.py), so they never change in place.
      { source: "/assets/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  async redirects() {
    return [
      // German is the unprefixed default, so `/de/...` is never a public URL.
      { source: "/de", destination: "/", permanent: true },
      { source: "/de/:path*", destination: "/:path*", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      // Account pages renamed to sign-in/sign-up; old addresses keep working.
      { source: "/auth/login", destination: "/auth/sign-in", permanent: true },
      { source: "/auth/register", destination: "/auth/sign-up", permanent: true },
      { source: "/auth/:mode.html", destination: "/auth/:mode", permanent: true },
      // Product pages live at /products/<slug> (app/[locale]/(product)); the earlier static
      // /theme-<slug> files and the /theme/<slug>, /extension/<slug> routes redirect there.
      { source: "/theme-:slug.html", destination: "/products/:slug", permanent: true },
      { source: "/theme-:slug", destination: "/products/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/theme-:slug.html`, destination: "/:locale/products/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/theme-:slug`, destination: "/:locale/products/:slug", permanent: true },
      { source: "/:kind(theme|extension)/:slug", destination: "/products/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/:kind(theme|extension)/:slug`, destination: "/:locale/products/:slug", permanent: true },
      { source: "/:slug.html", destination: "/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/index.html`, destination: "/:locale", permanent: true },
      { source: `/:locale(${prefixedLocales})/:slug.html`, destination: "/:locale/:slug", permanent: true },
    ];
  },
  async rewrites() {
    return {
      // The legacy page map lives in the proxy (lib/page-builder/proxy-pages.ts):
      // the builder's catch-all route matches page paths before these rewrite
      // phases could run, and direct requests to /legacy/* hit the proxy's 404
      // rewrite instead of this list.
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
