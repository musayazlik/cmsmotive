import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import "../../../public/assets/css/site.css";
import "../../../public/assets/css/legal.css";
export default async function LegalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  if (!isLocale((await params).locale)) notFound();
  return children;
}
