"use client";

import RowActions from "@/app/panel/_components/row-actions";

import Link from "@/app/panel/_components/panel-navigation";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../../_components/confirm-dialog";
import { Select } from "../../_components/ui";
import type { SelectOption } from "../../_components/ui";

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  planning: "Planning",
  "in-development": "In development",
  published: "Published",
};

const STATUS_BADGES: Record<string, string> = {
  published: "wbadge wbadge-verified",
  "in-development": "wbadge wbadge-pending",
  planning: "wbadge wbadge-user",
  concept: "wbadge wbadge-missing",
};

type Row = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: string;
  category: string | null;
  technologies: string[];
  type: { key: string; name: string };
  cover: { url: string; fileName: string } | null;
  ownedHere: boolean;
  position: number;
  prices: number;
  enabledPrices: number;
  releases: number;
  orders: number;
  updatedAt: string;
};

const PAGE_SIZES = [20, 50, 100];

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

/** Every product listed in the store, with its type, state and commerce counts. */
export default function ProductList({
  types,
  createHref,
  createLabel,
}: {
  types: SelectOption[];
  createHref: string;
  createLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      const response = await fetch(`/api/admin/products?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not load the products.");
        setRows([]);
        return;
      }
      setRows(payload.products);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      if (payload.totalPages > 0 && page > payload.totalPages) setPage(payload.totalPages);
    } catch {
      setError("Could not reach the server.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, status, type]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/products/${pendingDelete.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? "The product could not be deleted.");
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

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="pl-search">
              Search
            </label>
            <input
              id="pl-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, slug, summary or category…"
            />
          </div>
          <div className="wtable-filters">
            <Select
              label="Status"
              hideLabel
              placeholder="All statuses"
              emptyLabel="All statuses"
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="Type"
              hideLabel
              placeholder="All types"
              emptyLabel="All types"
              value={type}
              onChange={(next) => {
                setType(next);
                setPage(1);
              }}
              options={types}
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
            <Link className="wbtn wbtn-primary wbtn-add" href={createHref}>
              <span aria-hidden="true">+</span> {createLabel}
            </Link>
          </div>
        </div>

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Prices</th>
                <th scope="col">Releases</th>
                <th scope="col">Orders</th>
                <th scope="col">Updated</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="wtable-state">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="wtable-state wtable-state-error">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wtable-state">
                    {query || status || type ? "No products match the current search or filter." : "No products yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="wtable-user">
                        {row.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts
                          <img className="wtable-avatar wtable-avatar-img" src={row.cover.url} alt="" loading="lazy" />
                        ) : (
                          <span className="wtable-avatar" aria-hidden="true">
                            {row.name[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}
                        <div>
                          <strong>{row.name}</strong>
                          <small className="status-slug" title={`/products/${row.slug}`}>
                            /products/{row.slug}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{row.type.name}</td>
                    <td>
                      <span className={STATUS_BADGES[row.status] ?? "wbadge wbadge-missing"}>
                        {PRODUCT_STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td>
                      {row.prices === 0 ? (
                        <span className="wtable-date">—</span>
                      ) : (
                        <strong>
                          {row.enabledPrices} <small>of {row.prices} live</small>
                        </strong>
                      )}
                    </td>
                    <td>{row.releases}</td>
                    <td>{row.orders}</td>
                    <td>
                      <span className="wtable-date">{stamp(row.updatedAt)}</span>
                    </td>
                    <td className="wtable-actions-col">
                      <RowActions label={row.name} actions={[
                        { label: "Edit", href: `/panel/products/${row.id}` },
                        { label: "View on site", href: `/products/${row.slug}`, external: true },
                        ...(row.ownedHere
                          ? [{ label: "Delete", danger: true, separated: true, onSelect: () => setPendingDelete(row) }]
                          : []),
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">{total === 0 ? "No products" : `${from}–${to} of ${total}`}</p>
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
        title={`Delete ${pendingDelete?.name ?? "product"}?`}
        body="The product, its prices, releases, gallery links, changelog and reviews are permanently removed. Products with orders cannot be deleted. The images stay in the media library."
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
