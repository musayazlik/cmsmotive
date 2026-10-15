"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import type { LegacyDocument } from "@/lib/legacy-document";

/** Handled below instead; its standalone retry would reload rather than call `onRetry`. */
const STANDALONE_SCRIPT = "/assets/js/status.js";

/**
 * Renders a built static-site status page (static-site/404.html, 500.html)
 * inside the app, so topbar, header, newsletter and footer are exactly the
 * home page's. Stylesheets hoist into <head> only while this renders, which
 * keeps site.css out of the panel bundle.
 */
export function StatusDocument({
  document: doc,
  digest,
  onRetry,
}: {
  document: LegacyDocument;
  digest?: string;
  onRetry?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || "/";

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const node of root.querySelectorAll("[data-status-path]")) node.textContent = pathname;
    if (digest) {
      root.querySelector<HTMLElement>("[data-status-ref]")?.removeAttribute("hidden");
      for (const node of root.querySelectorAll("[data-status-digest]")) node.textContent = digest;
      for (const node of root.querySelectorAll("[data-status-hint]")) node.textContent = `ref ${digest}`;
    }
    const handleClick = (event: MouseEvent) => {
      if (!onRetry || !(event.target as Element).closest("[data-status-retry]")) return;
      event.preventDefault();
      onRetry();
    };
    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [pathname, digest, onRetry]);

  return (
    <>
      {doc.stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: doc.body }} />
      {doc.scripts
        .filter((src) => src !== STANDALONE_SCRIPT)
        .map((src) => (
          <Script key={src} src={src} strategy="afterInteractive" />
        ))}
    </>
  );
}
