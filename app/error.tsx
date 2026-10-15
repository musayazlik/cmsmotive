"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { ErrorInfo } from "next/error";
import errorHtml from "@/static-site/500.html";
import { parseLegacyDocument, rewriteLegacyHtml } from "@/lib/legacy-document";
import { localizeStatusHtml } from "@/lib/i18n/status-client";
import { StatusDocument } from "./_status/status-document";

const source = rewriteLegacyHtml(errorHtml, "500.html");

/**
 * Error boundary for public routes (the panel has its own in app/panel).
 * The markup is static-site/500.html, in the language of the current URL.
 * `retry` refreshes the segment's server data and re-renders it, which is
 * what a transient failure needs.
 */
export default function AppError({ error, retry }: ErrorInfo) {
  const pathname = usePathname() || "/";
  const doc = useMemo(() => parseLegacyDocument(localizeStatusHtml(source, pathname).html, "500.html"), [pathname]);

  useEffect(() => {
    console.error("app error boundary:", error);
  }, [error]);

  return (
    <>
      <title>{doc.title}</title>
      <meta name="robots" content="noindex" />
      <StatusDocument document={doc} digest={(error as { digest?: string }).digest} onRetry={retry} />
    </>
  );
}
