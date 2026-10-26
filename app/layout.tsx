import type { Metadata } from "next";
import { headers } from "next/headers";
import { FONT_PRELOADS } from "@/lib/fonts";
import { LOCALE_HEADER, isLocale } from "@/lib/i18n/config";
import { siteOrigin } from "@/lib/seo";
import AccountFeedback from "./_components/account-feedback";

/**
 * Defaults for the account area. Public pages opt back into indexing with
 * their own metadata (lib/seo.ts pageMetadata()); `metadataBase` turns their
 * root-relative canonical and share-image URLs into absolute ones.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteOrigin()),
    title: "Workspace — CMSMotive",
    description: "Your CMSMotive account and product workspace.",
    robots: { index: false, follow: false },
    icons: { icon: "/assets/icons/favicon.png" },
  };
}

/**
 * Deliberately bare: the panel pulls its stylesheet in app/panel/layout.tsx
 * and public pages ship their own site.css, so the workspace stylesheet
 * never leaks into public routes. Public pages get their language from
 * proxy.ts; the account area stays English.
 *
 * No explicit <head> element: the preload <link>s are rendered bare and
 * React hoists them into the head — so scripts or extensions that stamp
 * attributes onto <head> can no longer cause hydration mismatch noise.
 * (generate-metadata docs: plain <link> tags render fine; only
 * `<head>` as a hydrated element makes its attributes match strictly.)
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get(LOCALE_HEADER);
  return (
    <html lang={isLocale(locale) ? locale : "en"} className="js">
      {/* Every area renders in Manrope/DM Mono: fetch them with the HTML, not after its stylesheet. */}
      {FONT_PRELOADS.map((href) => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />)}
      <body>{children}<AccountFeedback /></body>
    </html>
  );
}
