"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import TextField from "@/app/panel/_components/ui/text-field";
import Switch from "@/app/panel/_components/ui/switch";
import { LOCALES, LOCALE_LABELS, localizePath, type Locale } from "@/lib/i18n/config";
import {
  isBuiltinLegalSlug, legalDocuments, legalDocumentPath, validateLegalDocuments,
  type LegalDocument, type LegalDocumentSettings,
} from "@/lib/legal-documents-shared";
import type { LegalSettings } from "@/lib/legal-settings-shared";
import { saveLegalDocumentsAction } from "../_actions";

const RichTextField = dynamic(() => import("@/app/panel/_components/editor/rich-text-field"), {
  loading: () => <div className="wtiptap is-loading" aria-busy="true" />,
});

export default function LegalPagesTable({ settings, saved }: { settings: LegalSettings; saved: LegalDocumentSettings }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("de");
  const [editing, setEditing] = useState<{ original: string | null; document: LegalDocument } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const rows = legalDocuments(settings, saved, locale);
  const document = editing?.document;
  const builtin = document ? isBuiltinLegalSlug(document.slug) : false;
  const editingKey = editing ? `${locale}/${editing.original ?? "new"}` : null;
  useEffect(() => {
    if (editingKey) window.document.getElementById("legal-page-title")?.focus();
  }, [editingKey]);

  function update<K extends keyof LegalDocument>(key: K, value: LegalDocument[K]) {
    setEditing((current) => current && ({ ...current, document: { ...current.document, [key]: value } }));
    setError("");
  }

  function persist(documents: LegalDocument[], success: string) {
    const parsed = validateLegalDocuments({ documents });
    if ("error" in parsed) { setError(parsed.error); return; }
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await saveLegalDocumentsAction(parsed.data);
        if (!result.ok) { setError(result.error); return; }
        setEditing(null);
        setMessage(success);
        router.refresh();
      } catch {
        setError("The page could not be saved. Your changes are still here; please try again.");
      }
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const { document: d, original } = editing;
    if (rows.some((row) => row.slug === d.slug && row.slug !== original)) {
      setError("A page with this address already exists in this language.");
      return;
    }
    persist([...saved.documents.filter((row) => !(row.locale === locale && row.slug === original)), d], "Page saved.");
  }

  function cancel() {
    const original = rows.find((row) => row.slug === editing?.original);
    if (JSON.stringify(document) !== JSON.stringify(original) && !window.confirm("Discard unsaved page changes?")) return;
    setEditing(null);
    setError("");
  }

  return (
    <div className="wtable-card wlegal-pages">
      <div className="wtable-toolbar wlegal-heading">
        <div>
          <h2>{document ? editing?.original ? "Edit legal page" : "New legal page" : "Legal pages"}</h2>
          <p>{document ? "Write your content, then choose where it appears." : "Edit your policies or add a new page. Published pages can appear in the footer."}</p>
        </div>
        {!document && <div className="wlegal-tools">
          <label className="wlegal-language">Language
            <select value={locale} onChange={(event) => { setLocale(event.target.value as Locale); setError(""); setMessage(""); }}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
            </select>
          </label>
          <button type="button" className="wbtn wbtn-primary" disabled={pending} onClick={() => {
            setError(""); setMessage("");
            setEditing({ original: null, document: { locale, slug: "", title: "", content: "", published: false, showInFooter: true } });
          }}>+ Add page</button>
        </div>}
      </div>
      {message && <p className="wlegal-message" role="status">{message}</p>}
      {error && <p className="wdialog-error" role="alert">{error}</p>}
      {document ? (
        <form onSubmit={submit}>
          <fieldset className="wlegal-editor" disabled={pending} inert={pending}>
            <div className="wlegal-fields">
              <TextField id="legal-page-title" label="Page title" value={document.title} onChange={(value) => update("title", value)} required maxLength={160} />
              <TextField label="Page address" value={document.slug} onChange={(value) => update("slug", value)} required maxLength={80}
                disabled={editing?.original !== null} placeholder="refund-policy"
                note={editing?.original ? "The address stays fixed so existing links keep working." : "Lowercase letters, numbers and hyphens. Example: refund-policy"} />
            </div>
            <p className="wfield-hint-block">{LOCALE_LABELS[locale]} · {localizePath(legalDocumentPath(document.slug || "your-page"), locale)}</p>
            <RichTextField id="legal-page-content" label="Page content" value={document.content} onChange={(value) => update("content", value)} placeholder="Write your policy…" />
            <div className="wlegal-fields">
              <Switch label={builtin ? "Required page · always published" : "Publish page"} checked={document.published} onChange={(value) => update("published", value)} disabled={builtin}
                note={builtin ? "Used by existing legal and account links." : "Drafts are only visible here. Publishing makes the page accessible on your site."} />
              <Switch label="Show in footer" checked={document.showInFooter} onChange={(value) => update("showInFooter", value)}
                note="Adds a link under Legal in the site footer once the page is published." />
            </div>
            {builtin && <p className="wfield-hint-block">Custom content replaces the generated text in this language. After editing terms or privacy, check the review and consent versions below.</p>}
          </fieldset>
          <div className="wsettings-foot">
            <span className="wfield-hint-block">Changes appear on the site after saving.</span>
            <div className="wsettings-actions">
              <button type="button" className="wbtn wbtn-ghost" disabled={pending} onClick={cancel}>Cancel</button>
              <button type="submit" className="wbtn wbtn-primary" disabled={pending}>{pending ? "Saving…" : "Save page"}</button>
            </div>
          </div>
        </form>
      ) : <>
        <div className="wtable-scroll" tabIndex={0} role="region" aria-label="Legal pages">
          <table className="wtable">
            <thead><tr><th scope="col">Page</th><th scope="col">Address</th><th scope="col">Status</th><th scope="col">Footer</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{rows.map((row) => {
              const customized = saved.documents.some((d) => d.locale === locale && d.slug === row.slug);
              const path = localizePath(legalDocumentPath(row.slug), locale);
              return <tr key={row.slug}>
                <td><div className="wtable-terms"><strong>{row.title}</strong><small>{isBuiltinLegalSlug(row.slug) ? customized ? "Custom content" : "Generated from business details" : "Custom page"}</small></div></td>
                <td><code>{path}</code></td>
                <td><span className={row.published ? "wbadge wbadge-verified" : "wbadge wbadge-user"}>{row.published ? "Published" : "Draft"}</span></td>
                <td>{row.published && row.showInFooter ? "Visible" : "Hidden"}</td>
                <td><div className="wtable-actions">
                  {row.published && <a className="wbtn wbtn-ghost wbtn-sm" href={path} target="_blank" rel="noreferrer" aria-label={`View ${row.title} (new tab)`}>View ↗</a>}
                  <button type="button" className="wbtn wbtn-ghost wbtn-sm" disabled={pending} aria-label={`Edit ${row.title}`} onClick={() => { setError(""); setMessage(""); setEditing({ original: row.slug, document: { ...row } }); }}>Edit</button>
                  {(!isBuiltinLegalSlug(row.slug) || customized) && <button type="button" className="wbtn wbtn-ghost wbtn-danger-ghost wbtn-sm" disabled={pending}
                    aria-label={`${isBuiltinLegalSlug(row.slug) ? "Reset" : "Delete"} ${row.title}`} onClick={() => {
                      if (window.confirm(isBuiltinLegalSlug(row.slug) ? "Replace this page with the generated default content?" : `Delete “${row.title}”? Its public page and footer link will be removed.`))
                        persist(saved.documents.filter((d) => !(d.locale === locale && d.slug === row.slug)), isBuiltinLegalSlug(row.slug) ? "Default content restored." : "Page deleted.");
                    }}>{isBuiltinLegalSlug(row.slug) ? "Reset" : "Delete"}</button>}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="wtable-foot"><p className="wtable-count">{rows.length} pages · {LOCALE_LABELS[locale]}</p><span className="wfield-hint-block">Each language has its own content and footer links.</span></div>
      </>}
    </div>
  );
}
