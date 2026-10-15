import { readdirSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Top-level static-site pages, read once at startup. Listing them explicitly
 * (instead of a catch-all) leaves every other URL unmatched, so Next renders
 * app/not-found.tsx with a real 404. Restart `pnpm dev` after adding a page.
 */
const legacySlugs = readdirSync(path.join(process.cwd(), "static-site"))
  .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
  .map((file) => file.slice(0, -5));

/** Rendered by app/not-found.tsx, app/error.tsx and the journal loader, never as pages of their own. */
const statusDocuments = new Set(["404", "500", "loading"]);

/** Static-site pages replaced by a React route (app/[locale]/blog). */
const reactRoutes = new Set(["blog"]);

/**
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
  async redirects() {
    return [
      // German is the unprefixed default, so `/de/...` is never a public URL.
      { source: "/de", destination: "/", permanent: true },
      { source: "/de/:path*", destination: "/:path*", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/auth/:mode.html", destination: "/auth/:mode", permanent: true },
      // Theme pages moved from the static /theme-<slug> files to /theme/<slug> (app/[locale]/(product)).
      { source: "/theme-:slug.html", destination: "/theme/:slug", permanent: true },
      { source: "/theme-:slug", destination: "/theme/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/theme-:slug.html`, destination: "/:locale/theme/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/theme-:slug`, destination: "/:locale/theme/:slug", permanent: true },
      { source: "/:slug.html", destination: "/:slug", permanent: true },
      { source: `/:locale(${prefixedLocales})/index.html`, destination: "/:locale", permanent: true },
      { source: `/:locale(${prefixedLocales})/:slug.html`, destination: "/:locale/:slug", permanent: true },
    ];
  },
  async rewrites() {
    const pages = legacySlugs.filter((slug) => !statusDocuments.has(slug) && !reactRoutes.has(slug));
    return {
      // The internal handler path is not a public URL: send it to a path no
      // route matches, which renders the regular 404 page.
      beforeFiles: [{ source: "/legacy/:path*", destination: "/__not-found" }],
      afterFiles: [
        // `/en/blog` matches app/[locale]/blog directly; the German journal needs its locale filled in.
        { source: "/blog", destination: "/de/blog" },
        { source: "/blog/:slug", destination: "/de/blog/:slug" },
        // Same for the theme and extension detail pages (app/[locale]/(product)).
        { source: "/theme/:slug", destination: "/de/theme/:slug" },
        { source: "/extension/:slug", destination: "/de/extension/:slug" },
        ...pages.flatMap((slug) => [
          { source: slug === "index" ? "/" : `/${slug}`, destination: `/legacy/de/${slug}` },
          {
            source: slug === "index" ? `/:locale(${prefixedLocales})` : `/:locale(${prefixedLocales})/${slug}`,
            destination: `/legacy/:locale/${slug}`,
          },
        ]),
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
