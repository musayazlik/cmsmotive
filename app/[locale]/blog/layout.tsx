import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import CustomMetaTags from "../_components/custom-metas";
import "../../../public/assets/css/site.css";

/**
 * Keep the public site stylesheet on both the journal and article routes.
 * `/blog` reaches this segment as `/de/blog` through next.config.ts; any
 * other first segment is not a site language.
 */
export default async function BlogLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  if (!isLocale((await params).locale)) notFound();
  return (
    <>
      {children}
      <CustomMetaTags />
    </>
  );
}
