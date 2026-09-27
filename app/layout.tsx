import type { Metadata } from "next";
import "./panel.css";

export const metadata: Metadata = {
  title: "Workspace — CMSMotive",
  description: "Your CMSMotive account and product workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/icons/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
