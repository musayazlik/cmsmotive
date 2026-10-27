"use client";

import Link, { useRouter } from "@/app/panel/_components/panel-navigation";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import RowActions from "@/app/panel/_components/row-actions";
import Select from "@/app/panel/_components/ui/select";
import TextField from "@/app/panel/_components/ui/text-field";
import { useToast } from "@/app/panel/_components/ui/toast";
import { useEffect, useRef, useState } from "react";
import { addLanguageAction, copyLanguageAction, createPageAction, deletePageAction, renamePageAction, unpublishPageAction } from "../_actions";
import { filterPages, STATUS_BADGES, STATUS_LABELS, type PageRow } from "../_lib";
import styles from "./pages-list.module.css";

const LOCALE_LABELS: Record<string, string> = { de: "Deutsch", en: "English", tr: "Türkçe" };
const KIND_LABELS: Record<string, string> = { home: "Home page", landing: "Landing page", page: "Content page" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type Dialog = { kind: "create" } | { kind: "rename"; row: PageRow } | { kind: "language"; row: PageRow; locale: string };

export default function PagesList({ rows, storeLocales, defaultLocale }: {
  rows: PageRow[];
  storeLocales: string[];
  defaultLocale: string;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<PageRow | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", locale: defaultLocale, kind: "landing" });
  const [sourceLocale, setSourceLocale] = useState("");

  useEffect(() => {
    const element = dialogRef.current;
    if (dialog && !element?.open) element?.showModal();
    if (!dialog && element?.open) element.close();
  }, [dialog]);

  function primaryTitle(row: PageRow) {
    return row.locales.find((locale) => locale.locale === defaultLocale)?.title ?? row.locales[0]?.title ?? (row.kind === "home" ? "Home page" : row.slug);
  }

  function editHref(row: PageRow) {
    const locale = row.locales.find((entry) => entry.locale === defaultLocale)?.locale ?? row.locales[0]?.locale ?? defaultLocale;
    return `/panel/pages/${row.id}/edit?locale=${locale}`;
  }

  function openDialog(next: Dialog) {
    setError("");
    setForm({ title: "", slug: next.kind === "rename" ? next.row.slug : "", locale: defaultLocale, kind: "landing" });
    setSourceLocale(next.kind === "language" ? next.row.locales[0]?.locale ?? "" : "");
    setDialog(next);
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string; pageId?: string }>, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Changes could not be saved. Please try again.");
        return;
      }
      done?.();
      if (result.pageId) router.push(`/panel/pages/${result.pageId}/edit?locale=${form.locale}`);
      else router.refresh();
    } catch {
      setError("Changes could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!dialog) return;
    if (dialog.kind === "create") {
      await run(() => createPageAction(form), () => setDialog(null));
    } else if (dialog.kind === "rename") {
      await run(() => renamePageAction(dialog.row.id, form.slug), () => {
        setDialog(null);
        showToast("Page address updated.", "success");
      });
    } else {
      const { row, locale } = dialog;
      const title = `${primaryTitle(row)} (${locale})`.slice(0, 120);
      await run(() => sourceLocale
        ? copyLanguageAction(row.id, sourceLocale, locale, title)
        : addLanguageAction(row.id, locale, title), () => {
        setDialog(null);
        showToast(`${LOCALE_LABELS[locale] ?? locale} version added as a draft.`, "success");
      });
    }
  }

  const visible = filterPages(rows, query, status);

  const dialogTitle = dialog?.kind === "create" ? "New page" : dialog?.kind === "rename" ? "Change page address" : `Add ${LOCALE_LABELS[dialog?.kind === "language" ? dialog.locale : ""] ?? "language"} version`;

  return (
    <div className={styles.pages}>
      <div className="wpage-stats">
        <div><span>Total pages</span><strong>{rows.length}</strong></div>
        <div><span>Published</span><strong>{rows.filter((row) => row.locales.some((locale) => locale.status === "published")).length}</strong></div>
        <div><span>With drafts</span><strong>{rows.filter((row) => row.locales.some((locale) => locale.status === "draft")).length}</strong></div>
        <div><span>Site languages</span><strong>{storeLocales.map((locale) => LOCALE_LABELS[locale] ?? locale).join(", ") || "None configured"}</strong></div>
      </div>

      <div className="wtable-card" aria-busy={busy}>
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or address" aria-label="Search pages" />
          </div>
          <div className="wtable-filters">
            <Select label="Language status" hideLabel value={status} onChange={setStatus} options={[
              { value: "all", label: "All statuses" },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]} />
          </div>
          <div className="wtable-tools">
            <button className="wbtn wbtn-primary wbtn-add" type="button" disabled={busy} onClick={() => openDialog({ kind: "create" })}>New page</button>
          </div>
        </div>

        {error && !dialog ? <p className={`wdialog-error ${styles.error}`} role="alert">{error}</p> : null}

        <div className="wtable-scroll" role="region" aria-label="Pages and language versions" tabIndex={0}>
          <table className={`wtable ${styles.table}`}>
            <thead><tr>
              <th scope="col">Page</th>
              <th scope="col">Language versions</th>
              <th scope="col">Last updated</th>
              <th scope="col" className="wtable-actions-col"><span className="visually-hidden">Actions</span></th>
            </tr></thead>
            <tbody>
              {visible.map((row) => {
                const title = primaryTitle(row);
                const editors = [...new Set(row.locales.map((locale) => locale.updatedByName).filter(Boolean))];
                return (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.identity}>
                        <span className={`${styles.pageIcon} ${row.kind === "home" ? styles.homeIcon : ""}`} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            {row.kind === "home" ? <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></> : <><path d="M14 3H5v18h14V8Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>}
                          </svg>
                        </span>
                        <div className={styles.pageName}>
                          <Link className={styles.title} href={editHref(row)}>{title}</Link>
                          <span className={styles.address}>{row.kind === "home" ? "/" : `/${row.slug}`}</span>
                          <span className={styles.kind}>{KIND_LABELS[row.kind] ?? row.kind}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.languages}>
                        {storeLocales.map((locale) => {
                          const existing = row.locales.find((entry) => entry.locale === locale);
                          return existing ? (
                            <Link key={locale} href={`/panel/pages/${row.id}/edit?locale=${locale}`} className={`${styles.locale} ${STATUS_BADGES[existing.status]}`} aria-label={`Edit ${title} in ${LOCALE_LABELS[locale] ?? locale}, ${STATUS_LABELS[existing.status]}`}>
                              <span className={styles.localeCode}>{locale}</span>
                              <span>{STATUS_LABELS[existing.status]}</span>
                            </Link>
                          ) : (
                            <button key={locale} type="button" className={`${styles.locale} ${styles.missing}`} disabled={busy} onClick={() => openDialog({ kind: "language", row, locale })} aria-label={`Add ${LOCALE_LABELS[locale] ?? locale} version of ${title}`}>
                              <span aria-hidden="true">+</span><span>{LOCALE_LABELS[locale] ?? locale}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <time className="wtable-date" dateTime={row.updatedAt}>{formatDate(row.updatedAt)}</time>
                      <span className={styles.editor}>{editors.join(", ") || "—"}</span>
                    </td>
                    <td className="wtable-actions-col">
                      <RowActions label={title} actions={[
                        { label: "Edit page", href: editHref(row) },
                        ...row.locales.map((locale) => ({ label: `Preview ${LOCALE_LABELS[locale.locale] ?? locale.locale}`, href: locale.previewPath, external: true })),
                        { label: "Change address", disabled: busy || row.kind === "home", separated: true, onSelect: () => openDialog({ kind: "rename", row }) },
                        ...row.locales.filter((locale) => locale.status === "published").map((locale) => ({ label: `Unpublish ${LOCALE_LABELS[locale.locale] ?? locale.locale}`, disabled: busy, onSelect: () => run(() => unpublishPageAction(row.id, locale.locale)) })),
                        { label: "Delete page", danger: true, separated: true, disabled: busy || row.kind === "home", onSelect: () => { setError(""); setPendingDelete(row); } },
                      ]} />
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? <tr><td colSpan={4} className="wtable-state">
                <div className={styles.empty}>
                  <strong>{rows.length === 0 ? "Create your first page" : "No pages found"}</strong>
                  <p>{rows.length === 0 ? "Start with a title, then build your page in the visual editor." : "Try another title, address or language status."}</p>
                  {rows.length === 0 ? <button className="wbtn wbtn-primary" type="button" disabled={busy} onClick={() => openDialog({ kind: "create" })}>New page</button> : <button className="wbtn wbtn-ghost" type="button" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button>}
                </div>
              </td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="wtable-foot">
          <p className="wtable-count" role="status">{visible.length} of {rows.length} pages</p>
          <span className={styles.hint}>Select a language version to edit its content.</span>
        </div>
      </div>

      <dialog ref={dialogRef} className="wdialog" aria-labelledby="page-dialog-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={() => setDialog(null)}>
        <div className="wdialog-head">
          <h2 id="page-dialog-title">{dialogTitle}</h2>
          <button type="button" className="wdialog-close" aria-label="Close" disabled={busy} onClick={() => setDialog(null)}>×</button>
        </div>
        <form className={styles.dialogForm} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="wdialog-body wform">
            {dialog?.kind === "create" ? <>
              <TextField label="Page title" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="About us" maxLength={120} required disabled={busy} />
              <TextField label="Page address" hint="Optional" note="Leave empty to generate an address from the title." value={form.slug} onChange={(slug) => setForm({ ...form, slug })} placeholder="about-us" disabled={busy} />
              <div className="wfield-row">
                <Select label="Language" value={form.locale} onChange={(locale) => setForm({ ...form, locale })} options={storeLocales.map((locale) => ({ value: locale, label: LOCALE_LABELS[locale] ?? locale }))} disabled={busy} />
                <Select label="Page type" value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={[{ value: "landing", label: "Landing page" }, { value: "page", label: "Content page" }]} disabled={busy} />
              </div>
            </> : dialog?.kind === "rename" ? <>
              <p className="wdialog-text">Change the address for “{primaryTitle(dialog.row)}”. The old address will redirect visitors to the new one.</p>
              <TextField label="New address" value={form.slug} onChange={(slug) => setForm({ ...form, slug })} placeholder="about-us" required disabled={busy} />
            </> : dialog?.kind === "language" ? <>
              <p className="wdialog-text">Add a {LOCALE_LABELS[dialog.locale] ?? dialog.locale} draft for “{primaryTitle(dialog.row)}”. Copied content keeps its original language until you translate it.</p>
              <Select label="Starting content" value={sourceLocale} onChange={setSourceLocale} disabled={busy} options={[
                { value: "", label: "Start with an empty page" },
                ...dialog.row.locales.map((locale) => ({ value: locale.locale, label: `Copy ${LOCALE_LABELS[locale.locale] ?? locale.locale} content` })),
              ]} />
            </> : null}
            {error ? <p className="wdialog-error" role="alert">{error}</p> : null}
          </div>
          <div className="wdialog-foot">
            <button className="wbtn wbtn-ghost" type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
            <button className="wbtn wbtn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : dialog?.kind === "create" ? "Create page" : dialog?.kind === "rename" ? "Save address" : "Add language"}</button>
          </div>
        </form>
      </dialog>

      <ConfirmDialog open={pendingDelete !== null} title={`Delete “${pendingDelete ? primaryTitle(pendingDelete) : ""}”?`} body={error || "Every language version, its revisions and the old-address redirects are removed. This cannot be undone."} confirmLabel="Delete page" busy={busy} onConfirm={() => {
        if (pendingDelete) void run(() => deletePageAction(pendingDelete.id), () => { setPendingDelete(null); showToast("Page deleted.", "success"); });
      }} onClose={() => { if (!busy) setPendingDelete(null); }} />
      {toast}
    </div>
  );
}
