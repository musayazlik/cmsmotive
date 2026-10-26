"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, Puck, type Data } from "@puckeditor/core";
import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { clientConfig } from "@/lib/page-builder/config.client";
import { EDITOR_VIEWPORTS, compileDocumentCss } from "@/lib/page-builder/style/css";
import { publishPageAction, saveSeoAction } from "../_actions";
import "../../../../lib/page-builder/editor.css";

/**
 * The page editor (plan 5.6): Puck in its iframe with the public page's own
 * stylesheets, plus the Faz 1 controls around it — delayed autosave through
 * the draft Route Handler with optimistic `version` locking, draft preview
 * via the signed link, publish (with accessibility blockers) and a readonly
 * revisions list. The panel shell renders bare on this route, so the toolbar
 * also carries the way back to /panel/pages.
 */

const STATIC_STYLESHEETS = ["/assets/css/fonts.css", "/assets/css/site.css", "/assets/css/pb-blocks.css"] as const;

/** Delay after the last change before the autosave request fires (plan 5.6: ~1.5 s). */
const AUTOSAVE_DEBOUNCE_MS = 1500;
/** Minimum distance between two autosave requests, whatever the typing pace. */
const AUTOSAVE_MIN_INTERVAL_MS = 5000;

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

export type EditorRevision = { id: string; note: string | null; createdAt: string };

export type EditorSeo = {
  title: string;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
};

export default function PageEditor({
  pageId,
  locale,
  storeLocales,
  pageSlug,
  kind,
  title,
  initialData,
  initialVersion,
  previewPath,
  revisions,
  seo,
}: {
  pageId: string;
  locale: string;
  storeLocales: string[];
  pageSlug: string;
  kind: string;
  title: string;
  initialData: Data;
  initialVersion: number;
  previewPath: string;
  revisions: EditorRevision[];
  seo: EditorSeo;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishOutcome, setPublishOutcome] = useState<
    | { state: "ok"; warnings: string[] }
    | { state: "blocked"; error: string; blockers: string[] }
    | null
  >(null);

  const versionRef = useRef(initialVersion);
  const latestRef = useRef<Data>(initialData);
  const savedJsonRef = useRef<string>(JSON.stringify(initialData));
  const inflightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttemptRef = useRef(0);
  const seoVersionRef = useRef(initialVersion);
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoValues, setSeoValues] = useState<EditorSeo>(seo);
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoFeedback, setSeoFeedback] = useState<string | null>(null);

  async function saveSeo() {
    setSeoSaving(true);
    setSeoFeedback(null);
    const result = await saveSeoAction(pageId, locale, {
      title: seoValues.title,
      seoTitle: seoValues.seoTitle || undefined,
      seoDescription: seoValues.seoDescription || undefined,
      noindex: seoValues.noindex,
      expectedVersion: seoVersionRef.current,
    });
    setSeoSaving(false);
    if (result.ok) {
      if (typeof result.version === "number") {
        seoVersionRef.current = result.version;
        versionRef.current = result.version;
      }
      setSeoFeedback("SEO settings saved.");
    } else {
      setSeoFeedback(result.error);
    }
  }

  const saveNow = useCallback(async () => {
    // Single flight with a trailing save: a change landing mid-request loops
    // once more with the newest state instead of recursing.
    for (;;) {
      if (inflightRef.current) {
        pendingRef.current = true;
        return;
      }
      pendingRef.current = false;
      const data = latestRef.current;
      const run = (async () => {
        setStatus("saving");
        setSaveError(null);
        try {
          const response = await fetch(`/api/admin/pages/${pageId}/draft`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locale, doc: data, expectedVersion: versionRef.current }),
          });
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; version?: number; error?: string }
            | null;
          if (response.ok && payload?.ok && typeof payload.version === "number") {
            versionRef.current = payload.version;
            savedJsonRef.current = JSON.stringify(data);
            setStatus("saved");
          } else if (response.status === 409) {
            setConflictVersion(typeof payload?.version === "number" ? payload.version : null);
            setStatus("error");
          } else {
            setSaveError(payload?.error ?? "The draft could not be saved.");
            setStatus("error");
          }
        } catch {
          setSaveError("Network error while saving.");
          setStatus("error");
        } finally {
          inflightRef.current = null;
        }
      })();
      inflightRef.current = run;
      await run;
      if (!pendingRef.current) return;
    }
  }, [pageId, locale]);

  const scheduleSave = useCallback(() => {
    if (conflictVersion !== null) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const sinceLast = Date.now() - lastAttemptRef.current;
    const delay = Math.max(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MIN_INTERVAL_MS - sinceLast);
    timerRef.current = setTimeout(() => {
      lastAttemptRef.current = Date.now();
      void saveNow();
    }, delay);
  }, [conflictVersion, saveNow]);

  /** The publish action reads the SAVED draft from the database. */
  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (inflightRef.current) await inflightRef.current;
    if (JSON.stringify(latestRef.current) !== savedJsonRef.current) await saveNow();
  }, [saveNow]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latestRef.current) !== savedJsonRef.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function publish() {
    setPublishing(true);
    setPublishOutcome(null);
    await flushSave();
    if (conflictVersion !== null) {
      setPublishing(false);
      setPublishOutcome({ state: "blocked", error: "Çakışma var: taslak başka bir sekmede güncellendi. Yenileyin.", blockers: [] });
      return;
    }
    const result = await publishPageAction(pageId, locale, undefined, versionRef.current);
    setPublishing(false);
    if (result.ok) {
      versionRef.current = result.version;
      setPublishOutcome({ state: "ok", warnings: result.warnings });
      router.refresh();
    } else {
      setPublishOutcome({ state: "blocked", error: result.error, blockers: result.blockers ?? [] });
    }
  }

  const address = kind === "home" ? "/" : `/${pageSlug}`;

  return (
    <div className="pb-editor">
      <div className="pb-editor-toolbar">
        <Link className="pb-editor-button" href="/panel/pages" onClick={() => void flushSave()}>
          ← Pages
        </Link>
        <span className="pb-editor-address">
          {address} · {title} ({locale})
        </span>
        <span className="pb-editor-toolbar-spacer" />
        {storeLocales.map((candidate) =>
          candidate === locale ? (
            <strong key={candidate} className="pb-editor-button" aria-current="true">
              {candidate}
            </strong>
          ) : (
            <Link
              key={candidate}
              className="pb-editor-button"
              href={`/panel/pages/${pageId}/edit?locale=${candidate}`}
              onClick={() => void flushSave()}
            >
              {candidate}
            </Link>
          ),
        )}
        <a className="pb-editor-button" href={previewPath} target="_blank" rel="noopener">
          Preview
        </a>
        <button type="button" className="pb-editor-button" onClick={() => setSeoOpen((open) => !open)}>
          SEO
        </button>
        {seoOpen ? (
          <div className="pb-editor-seo" role="dialog" aria-label="SEO settings">
            <label className="pb-editor-seo-row">
              <span>Page title</span>
              <input
                type="text"
                value={seoValues.title}
                maxLength={120}
                onChange={(event) => setSeoValues((values) => ({ ...values, title: event.currentTarget.value }))}
              />
            </label>
            <label className="pb-editor-seo-row">
              <span>SEO title (meta, max 60)</span>
              <input
                type="text"
                value={seoValues.seoTitle}
                maxLength={60}
                onChange={(event) => setSeoValues((values) => ({ ...values, seoTitle: event.currentTarget.value }))}
              />
            </label>
            <label className="pb-editor-seo-row">
              <span>Meta description (max 160)</span>
              <textarea
                value={seoValues.seoDescription}
                maxLength={160}
                rows={3}
                onChange={(event) => setSeoValues((values) => ({ ...values, seoDescription: event.currentTarget.value }))}
              />
            </label>
            <label className="pb-editor-seo-row pb-editor-seo-check">
              <input
                type="checkbox"
                checked={seoValues.noindex}
                onChange={(event) => setSeoValues((values) => ({ ...values, noindex: event.currentTarget.checked }))}
              />
              <span>Hide from search engines (noindex)</span>
            </label>
            <div className="pb-editor-seo-actions">
              <button type="button" className="pb-editor-button" data-variant="primary" disabled={seoSaving} onClick={() => void saveSeo()}>
                {seoSaving ? "Saving…" : "Save SEO settings"}
              </button>
              {seoFeedback ? <span className="pb-editor-seo-feedback">{seoFeedback}</span> : null}
            </div>
          </div>
        ) : null}
        <details className="pb-editor-revisions">
          <summary className="pb-editor-button">Revisions ({revisions.length})</summary>
          <ul className="pb-editor-revisions-list">
            {revisions.length === 0 ? <li>No revisions yet — they are written on every publish.</li> : null}
            {revisions.map((revision) => (
              <li key={revision.id}>
                <span className="pb-editor-revision-note">{revision.note ?? "Published"}</span>
                <span className="pb-editor-revision-date">
                  {new Date(revision.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </details>
        <button type="button" className="pb-editor-button" disabled={status === "saving" || conflictVersion !== null} onClick={() => void saveNow()}>
          Save draft
        </button>
        <button type="button" className="pb-editor-button" data-variant="primary" disabled={publishing || conflictVersion !== null} onClick={() => void publish()}>
          {publishing ? "Publishing…" : "Publish page"}
        </button>
      </div>

      {conflictVersion !== null ? (
        <div className="pb-editor-conflict" role="alert">
          <span>
            This draft changed elsewhere (version {conflictVersion}). Autosave is paused so nothing is overwritten.
          </span>
          <button type="button" className="pb-editor-button" onClick={() => window.location.reload()}>
            Reload the editor
          </button>
        </div>
      ) : null}

      {publishOutcome ? (
        <div className="pb-editor-publish-result" data-outcome={publishOutcome.state} role="status">
          {publishOutcome.state === "ok" ? (
            <>
              <strong>Published.</strong> The page is live at {address}
              {publishOutcome.warnings.length ? (
                <ul>
                  {publishOutcome.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <strong>{publishOutcome.error}</strong>
              {publishOutcome.blockers.length ? (
                <ul>
                  {publishOutcome.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="pb-editor-status" role="status" aria-live="polite" data-state={status}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Draft saved" : null}
        {status === "error" && saveError ? <span className="pb-editor-error">{saveError}</span> : null}
      </div>

      <Puck
        config={clientConfig}
        data={initialData}
        onPublish={() => void saveNow()}
        onChange={(data) => {
          latestRef.current = data;
          if (JSON.stringify(data) === savedJsonRef.current) return;
          scheduleSave();
        }}
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
