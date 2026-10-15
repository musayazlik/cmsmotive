import type { Metadata } from "next";
import { headers } from "next/headers";
import { LOCALE_HEADER, isLocale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Workspace — CMSMotive",
  description: "Your CMSMotive account and product workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/icons/favicon.png" },
};

/**
 * Deliberately bare: the panel pulls its stylesheet in app/panel/layout.tsx
 * and public pages ship their own site.css, so the workspace stylesheet
 * never leaks into public routes. Public pages get their language from
 * proxy.ts; the account area stays English.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get(LOCALE_HEADER);
  return <html lang={isLocale(locale) ? locale : "en"} className="js"><body>{children}</body></html>;
}
