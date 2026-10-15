import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import "../../../public/assets/css/site.css";
import "../../../public/assets/css/product.css";

/**
 * Theme and extension detail pages (/theme/<slug>, /extension/<slug>). The
 * German pages reach this segment as /de/... through next.config.ts; any
 * other first segment is not a site language.
 */
export default async function ProductLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  if (!isLocale((await params).locale)) notFound();
  return children;
}
