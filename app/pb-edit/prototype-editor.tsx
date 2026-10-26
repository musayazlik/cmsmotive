"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, Puck, type Data } from "@puckeditor/core";
import { clientConfig } from "@/lib/page-builder/config.client";
import { EDITOR_VIEWPORTS, compileDocumentCss } from "@/lib/page-builder/style/css";
import { savePrototypeDocument, type SaveDocumentResult } from "./_actions";
import "./prototype-editor.css";

/**
 * <Puck> wrapper for the prototype (plan 5.6). The preview stays in Puck's
 * iframe so the canvas really renders the public page's stylesheets:
 * site.css/fonts.css/pb-blocks.css get appended to the iframe head here, and
 * the scoped page CSS is re-derived live from the editor state with the same
 * compileDocumentCss() the public page uses. `site.js` is never loaded and
 * the host document never receives site.css (syncHostStyles stays off).
 */

const STATIC_STYLESHEETS = ["/assets/css/fonts.css", "/assets/css/site.css", "/assets/css/pb-blocks.css"] as const;

function IframeStylesheets({ document: iframeDocument }: { document?: Document }) {
  useEffect(() => {
    if (!iframeDocument) return;
    for (const href of STATIC_STYLESHEETS) {
      if (iframeDocument.head.querySelector(`link[href="${href}"]`)) continue;
      const link = iframeDocument.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      iframeDocument.head.appendChild(link);
    }
  }, [iframeDocument]);
  return null;
}

/** Live scoped styles, portaled into the iframe head so React owns updates. */
const usePuckApi = createUsePuck();

function ScopedStyles({ iframeDocument }: { iframeDocument?: Document }) {
  const data = usePuckApi((store) => store.appState.data);
  const css = useMemo(() => compileDocumentCss(data), [data]);
  if (!iframeDocument) return null;
  return createPortal(<style dangerouslySetInnerHTML={{ __html: css }} />, iframeDocument.head);
}

function IframeOverride({ children, document }: { children: ReactNode; document?: Document }) {
  return (
    <>
      <IframeStylesheets document={document} />
      <ScopedStyles iframeDocument={document} />
      {children}
    </>
  );
}

export function PrototypeEditor({ initialData }: { initialData: Data }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async (data: Data) => {
    setStatus("saving");
    setError(null);
    const result: SaveDocumentResult = await savePrototypeDocument(data);
    if (result.ok) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error);
    }
  };

  return (
    <div className="prototype-editor">
      <div className="prototype-editor-status" role="status" aria-live="polite" data-state={status}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Draft saved" : null}
        {status === "error" && error ? <span className="prototype-editor-error">{error}</span> : null}
      </div>
      <Puck
        config={clientConfig}
        data={initialData}
        onPublish={handlePublish}
        viewports={EDITOR_VIEWPORTS.map((viewport) => ({
          width: viewport.width,
          height: "auto",
          label: viewport.label,
          icon: viewport.icon,
        }))}
        iframe={{ enabled: true, waitForStyles: true, syncHostStyles: false }}
        overrides={{ iframe: IframeOverride }}
      />
    </div>
  );
}
