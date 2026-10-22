"use client";

import RowActions from "@/app/panel/_components/row-actions";

import Link from "@/app/panel/_components/panel-navigation";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../../_components/confirm-dialog";
import { Select } from "../../_components/ui";
import type { ProductOption } from "../_lib";

type Row = {
  id: string;
  version: string;
  title: string;
  releasedAt: string;
  createdAt: string;
  changeCount: number;
  product: { type: "theme" | "extension"; id: string; name: string; slug: string } | null;
};

const PAGE_SIZES = [20, 50, 100];

const month = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(iso));
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Every changelog entry, the most recently added first, filterable by product. */
export default function ChangelogList({ products, initialProduct = "" }: { products: ProductOption[]; initialProduct?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filterOptions: ProductOption[] = [
    { value: "type:theme", label: "All themes" },
    { value: "type:extension", label: "All extensions" },
    ...products,
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (product) params.set("product", product);
      const response = await fetch(`/api/admin/changelog?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not load the changelog.");
        setRows([]);
        return;
      }
      setRows(payload.entries);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      if (payload.totalPages > 0 && page > payload.totalPages) setPage(payload.totalPages);
    } catch {
      setError("Could not reach the server.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, product]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/changelog/${pendingDelete.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? "The entry could not be deleted.");
      else await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const newHref = product && !product.startsWith("type:") ? `/panel/changelog/new?product=${product}` : "/panel/changelog/new";

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="cl-search">
              Search
            </label>
            <input
              id="cl-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search version, title or product…"
            />
          </div>
          <div className="wtable-filters">
            <Select
              label="Product"
              hideLabel
              placeholder="All products"
              emptyLabel="All products"
              value={product}
              onChange={(next) => {
                setProduct(next);
                setPage(1);
              }}
              options={filterOptions}
            />
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
            <Link className="wbtn wbtn-primary wbtn-add" href={newHref}>
              <span aria-hidden="true">+</span> New entry
            </Link>
          </div>
        </div>

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Release</th>
                <th scope="col">Released</th>
                <th scope="col">Added</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="wtable-state">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="wtable-state wtable-state-error">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wtable-state">
                    {query || product ? "No entries match the current search or filter." : "No changelog entries yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`wproduct-type is-${row.product?.type ?? "removed"}`}>{row.product?.type ?? "removed"}</span>
                      <strong className="wproduct-name">{row.product?.name ?? "—"}</strong>
                    </td>
                    <td>
                      <div className="wrelease">
                        <span className="wrelease-version">{row.version}</span>
                        <span>
                          <strong>{row.title}</strong>
                          <small>
                            {row.changeCount} {row.changeCount === 1 ? "change" : "changes"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="wtable-date">{month(row.releasedAt)}</span>
                    </td>
                    <td>
                      <span className="wtable-date">{stamp(row.createdAt)}</span>
                    </td>
                    <td className="wtable-actions-col">
                      <RowActions label={row.title} actions={[
                        { label: "Edit", href: `/panel/changelog/${row.id}` },
                        { label: "Delete", danger: true, separated: true, onSelect: () => setPendingDelete(row) },
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">{total === 0 ? "No entries" : `${from}–${to} of ${total}`}</p>
          <nav className="wpager" aria-label="Pagination">
            <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setPage(1)} disabled={page <= 1 || loading}>
              «
            </button>
            <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1 || loading}>
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
            <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading}>
              »
            </button>
          </nav>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.version ?? "entry"}?`}
        body="The entry disappears from the product's Changelog tab. This cannot be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
