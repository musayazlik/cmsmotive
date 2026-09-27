import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace — CMSMotive",
  description: "Your CMSMotive account and product workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/icons/favicon.png" },
};

/**
 * Deliberately bare: the panel pulls its stylesheet in app/panel/layout.tsx
 * and public pages ship their own site.css, so the workspace stylesheet
 * never leaks into public routes.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="js"><body>{children}</body></html>;
}
