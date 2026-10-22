"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "./confirm-dialog";
import { MultiSelect, Select } from "./ui";
import { EXTENSION_STATUSES, THEME_INDUSTRIES, THEME_STATUSES } from "@/lib/catalog-guard";

type Row = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: string;
  cover: { assetId: string; url: string; fileName: string } | null;
  gallery: { assetId: string; url: string; fileName: string }[];
  createdAt: string;
};

type Props = {
  api: string;
  resourceKey: "themes" | "extensions";
  variant: "theme" | "extension";
  createHref: string;
  createLabel: string;
  emptyText: string;
};

const PAGE_SIZES = [20, 50, 100];

export default function CatalogList({ api, resourceKey, variant, createHref, createLabel, emptyText }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const hasFilters = statusFilter.length > 0 || (variant === "theme" && industryFilter !== "");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter.length > 0) params.set("status", statusFilter.join(","));
      if (variant === "theme" && industryFilter) params.set("industry", industryFilter);
      const response = await fetch(`${api}?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not load records.");
        setRows([]);
        return;
      }
      setRows(payload[resourceKey] ?? []);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      if (payload.totalPages > 0 && page > payload.totalPages) setPage(payload.totalPages);
    } catch {
      setError("Could not reach the server.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, page, pageSize, query, resourceKey, variant, statusFilter, industryFilter]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      const response = await fetch(`${api}/${pendingDelete.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload.error ?? "The record could not be deleted.");
        return;
      }
      await load();
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="c-search">
              Search
            </label>
            <input
              id="c-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, slug, summary…"
            />
          </div>
          <div className="wtable-filters">
            <MultiSelect
              label="Status"
              hideLabel
              placeholder="All statuses"
              value={statusFilter}
              onChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
              options={variant === "theme" ? THEME_STATUSES : EXTENSION_STATUSES}
            />
            {variant === "theme" ? (
              <Select
                label="Industry"
                hideLabel
                placeholder="All industries"
                emptyLabel="All industries"
                value={industryFilter}
                onChange={(next) => {
                  setIndustryFilter(next);
                  setPage(1);
                }}
                options={THEME_INDUSTRIES}
              />
            ) : null}
            {hasFilters ? (
              <button
                className="wbtn wbtn-ghost wbtn-sm"
                type="button"
                onClick={() => {
                  setStatusFilter([]);
                  setIndustryFilter("");
                  setPage(1);
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
          <div className="wtable-tools">
            <span className="wtable-size">
              <span>Show</span>
              <Select
                label="Rows per page"
                hideLabel
                value={String(pageSize)}
                onChange={(next) => {
                  setPageSize(Number(next));
                  setPage(1);
                }}
                options={PAGE_SIZES.map(String)}
              />
              <span>per page</span>
            </span>
            <Link className="wbtn wbtn-primary wbtn-add" href={createHref}>
              <span aria-hidden="true">+</span> {createLabel}
            </Link>
          </div>
        </div>

        {actionError ? (
          <p className="wdialog-error wpost-feedback" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Slug</th>
                <th scope="col">Status</th>
                <th scope="col">Media</th>
                <th scope="col">Added</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="wtable-state wtable-state-error">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    {query || hasFilters ? "No records match the current search or filters." : emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="wtable-user">
                        {row.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="wtable-avatar wtable-avatar-img" src={row.cover.url} alt="" />
                        ) : (
                          <span className="wtable-avatar" aria-hidden="true">
                            {row.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <strong>{row.name}</strong>
                          <small>
                            {row.summary.slice(0, 70)}
                            {row.summary.length > 70 ? "…" : ""}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="wtable-date">{row.slug}</span>
                    </td>
                    <td>
                      <span className="wbadge">{row.status}</span>
                    </td>
                    <td>
                      <span className="wtable-date">
                        {row.cover ? "cover" : "—"} · {row.gallery.length} gallery
                      </span>
                    </td>
                    <td>
                      <span className="wtable-date">
                        {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
                          new Date(row.createdAt),
                        )}
                      </span>
                    </td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <Link className="wbtn wbtn-ghost wbtn-sm" href={`/panel/${resourceKey}/${row.id}`}>
                          Edit
                        </Link>
                        <button
                          className="wbtn wbtn-ghost wbtn-sm wbtn-danger-ghost"
                          type="button"
                          onClick={() => setPendingDelete(row)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">{total === 0 ? "No records" : `${from}–${to} of ${total}`}</p>
          <nav className="wpager" aria-label="Pagination">
            <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setPage(1)} disabled={page <= 1 || loading}>
              «
            </button>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1 || loading}
            >
              ‹
            </button>
            <span className="wpager-state">
              Page {page} / {totalPages}
            </span>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              disabled={page >= totalPages || loading}
            >
              ›
            </button>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
            >
              »
            </button>
          </nav>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? variant}?`}
        body="The record and its gallery will be permanently removed. The uploaded images stay in the media library. This cannot be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
