"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import { useToast } from "@/app/panel/_components/ui/toast";
import { useState } from "react";
import { addLanguageAction, copyLanguageAction, createPageAction, deletePageAction, renamePageAction, unpublishPageAction } from "../_actions";
import { STATUS_BADGES, STATUS_LABELS, type PageRow } from "../_lib";

/**
 * The pages table (plan 5.6): one row per page, one chip per store language.
 * Creating a page jumps straight into the editor; renaming and deleting run
 * through the server actions, which re-check role and store scope.
 */

const LOCALE_LABELS: Record<string, string> = { de: "Deutsch", en: "English", tr: "Türkçe" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PagesList({
  rows,
  storeLocales,
  defaultLocale,
}: {
  rows: PageRow[];
  storeLocales: string[];
  defaultLocale: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<PageRow | null>(null);
  const [renameSlug, setRenameSlug] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PageRow | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", locale: defaultLocale, kind: "landing" });

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    done?.();
    router.refresh();
  }

  function primaryTitle(row: PageRow) {
    return row.locales.find((locale) => locale.locale === defaultLocale)?.title ?? row.locales[0]?.title ?? row.slug;
  }

  async function create() {
    await run(
      () => createPageAction(form),
      () => {
        setCreating(false);
        setForm({ title: "", slug: "", locale: defaultLocale, kind: "landing" });
        showToast("Page created. Opening the editor…");
      },
    );
  }

  return (
    <div className="workspace-panel">
      {error ? (
        <p className="workspace-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="workspace-toolbar">
        <span className="workspace-toolbar-caption">
          {rows.length} page{rows.length === 1 ? "" : "s"}
        </span>
        <button className="wbtn wbtn-primary" type="button" onClick={() => setCreating((open) => !open)}>
          {creating ? "Cancel" : "New page"}
        </button>
      </div>

      {creating ? (
        <form
          className="workspace-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label className="workspace-field">
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Black Friday landing page"
              maxLength={120}
              required
            />
          </label>
          <label className="workspace-field">
            <span>Address (optional, /{form.slug || "your-page"})</span>
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="black-friday"
            />
          </label>
          <label className="workspace-field">
            <span>Language</span>
            <select value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
              {storeLocales.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale] ?? locale}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace-field">
            <span>Type</span>
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              <option value="landing">Landing page</option>
              <option value="page">Content page</option>
            </select>
          </label>
          <button className="wbtn wbtn-primary" type="submit" disabled={busy}>
            Create page
          </button>
        </form>
      ) : null}

      <table className="workspace-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Languages</th>
            <th>Updated</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{primaryTitle(row)}</strong>
                <div className="workspace-table-sub">
                  {row.kind === "home" ? (
                    <span className="wbadge wbadge-pending">Home (root, Faz 3)</span>
                  ) : (
                    <code>/{row.slug}</code>
                  )}
                </div>
              </td>
              <td>
                <div className="workspace-chip-row">
                  {storeLocales.map((locale) => {
                    const existing = row.locales.find((candidate) => candidate.locale === locale);
                    if (!existing) {
                      const sources = row.locales.map((candidate) => candidate.locale);
                      return (
                        <span key={locale} className="workspace-locale-chip">
                          {sources.length > 0 ? (
                            <select
                              aria-label={`Create the ${LOCALE_LABELS[locale] ?? locale} version from another language`}
                              className="workspace-locale-copy"
                              disabled={busy}
                              defaultValue=""
                              onChange={(event) => {
                                const source = event.currentTarget.value;
                                event.currentTarget.value = "";
                                if (!source) return;
                                void run(() =>
                                  copyLanguageAction(
                                    row.id,
                                    source,
                                    locale,
                                    `${primaryTitle(row)} (${locale})`.slice(0, 120),
                                  ),
                                );
                              }}
                            >
                              <option value="">+ {locale} from…</option>
                              {sources.map((source) => (
                                <option key={source} value={source}>
                                  Copy {source} content
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            type="button"
                            className="wbadge wbadge-add"
                            disabled={busy}
                            title={`Create an empty ${LOCALE_LABELS[locale] ?? locale} version`}
                            onClick={() =>
                              void run(() =>
                                addLanguageAction(row.id, locale, `${primaryTitle(row)} (${locale})`.slice(0, 120)),
                              )
                            }
                          >
                            + {locale}
                          </button>
                        </span>
                      );
                    }
                    return (
                      <span key={locale} className="workspace-locale-chip">
                        <Link href={`/panel/pages/${row.id}/edit?locale=${locale}`} className="workspace-locale-link">
                          {locale}
                        </Link>
                        <span className={STATUS_BADGES[existing.status]}>{STATUS_LABELS[existing.status]}</span>
                        {existing.status === "published" ? (
                          <button
                            type="button"
                            className="workspace-linklike"
                            disabled={busy}
                            onClick={() => void run(() => unpublishPageAction(row.id, locale))}
                          >
                            Unpublish
                          </button>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td>
                {(() => {
                  const lastPublish = row.locales
                    .map((locale) => locale.publishedAt)
                    .filter((value): value is string => Boolean(value))
                    .sort()
                    .at(-1);
                  const editors = [...new Set(row.locales.map((locale) => locale.updatedByName).filter(Boolean))];
                  return (
                    <>
                      {lastPublish ? `Published ${formatDate(lastPublish)}` : formatDate(row.updatedAt)}
                      <div className="workspace-table-sub">{editors.join(", ") || "—"}</div>
                    </>
                  );
                })()}
              </td>
              <td className="workspace-table-actions">
                <Link className="wbtn" href={`/panel/pages/${row.id}/edit?locale=${defaultLocale}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="wbtn"
                  disabled={busy || row.kind === "home"}
                  onClick={() => {
                    setRenaming(row);
                    setRenameSlug(row.slug);
                  }}
                >
                  Rename
                </button>
                <button type="button" className="wbtn wbtn-danger" disabled={busy || row.kind === "home"} onClick={() => setPendingDelete(row)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No pages yet — create the first one above.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {renaming ? (
        <form
          className="workspace-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () => renamePageAction(renaming.id, renameSlug),
              () => setRenaming(null),
            );
          }}
        >
          <h2>Rename /{renaming.slug}</h2>
          <p>
            The old address keeps working: visitors and search engines follow a permanent redirect to the new one
            (plan 5.8).
          </p>
          <label className="workspace-field">
            <span>New address</span>
            <input value={renameSlug} onChange={(event) => setRenameSlug(event.target.value)} required />
          </label>
          <div className="workspace-form-row">
            <button className="wbtn wbtn-primary" type="submit" disabled={busy}>
              Rename page
            </button>
            <button className="wbtn" type="button" onClick={() => setRenaming(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete ? primaryTitle(pendingDelete) : ""}”?`}
        body="Every language version, its revisions and the old-address redirects are removed. The public address goes back to the previous site. This cannot be undone."
        confirmLabel="Delete page"
        onConfirm={() => {
          const page = pendingDelete;
          setPendingDelete(null);
          if (page) void run(() => deletePageAction(page.id));
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
