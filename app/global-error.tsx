"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import type { ErrorInfo } from "next/error";
import errorHtml from "@/static-site/500.html";
import { parseLegacyDocument, rewriteLegacyHtml } from "@/lib/legacy-document";
import { localizeStatusHtml } from "@/lib/i18n/status-client";
import { StatusDocument } from "./_status/status-document";

const source = rewriteLegacyHtml(errorHtml, "500.html");

/**
 * Last-resort boundary for errors thrown by the root layout itself. It
 * replaces that layout, so it ships its own <html> and <body>, in the
 * language of the current URL.
 */
export default function GlobalError({ error, retry }: ErrorInfo) {
  const pathname = usePathname() || "/";
  const { locale, doc } = useMemo(() => {
    const localized = localizeStatusHtml(source, pathname);
    return { locale: localized.locale, doc: parseLegacyDocument(localized.html, "500.html") };
  }, [pathname]);

  return (
    <html lang={locale} className="js">
      <body>
        <title>{doc.title}</title>
        <meta name="robots" content="noindex" />
        <StatusDocument document={doc} digest={(error as { digest?: string }).digest} onRetry={retry} />
      </body>
    </html>
  );
}
