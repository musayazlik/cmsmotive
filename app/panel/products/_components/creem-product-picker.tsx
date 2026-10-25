"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CREEM_BILLING_PERIOD, INTERVAL_LABELS, formatAmount, type BillingInterval } from "@/lib/prices";

/** One product of the active Creem environment as /api/admin/creem/products returns it. */
export type CreemProductOption = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  billingType: string;
  billingPeriod: string | null;
  taxMode: string | null;
  status: string | null;
};

type Props = {
  open: boolean;
  /** The active Creem environment; only its products can be listed. */
  mode: string;
  onClose: () => void;
  onSelect: (product: CreemProductOption) => void;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/** "every-month" → "monthly", using the panel's own billing labels. */
function periodLabel(product: CreemProductOption) {
  if (product.billingType !== "recurring") return "one-time";
  const entry = (Object.entries(CREEM_BILLING_PERIOD) as [BillingInterval, string][]).find(
    ([, period]) => period === product.billingPeriod,
  );
  return entry ? INTERVAL_LABELS[entry[0]].adjective.toLowerCase() : (product.billingPeriod ?? "recurring");
}

/**
 * Creem product dialog: lists the products of the active Creem environment so a
 * price can be linked without copy-pasting IDs. Products another price already
 * uses (IDs are globally unique) and archived ones Creem would refuse are
 * shown but not selectable. Rendered into <body> so it never nests inside the
 * page's form.
 */
export default function CreemProductPicker({ open, mode, onClose, onSelect }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CreemProductOption[]>([]);
  const [linked, setLinked] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/creem/products");
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data.error ?? "Creem products could not be loaded.");
        return;
      }
      setItems(data.items);
      setLinked(data.linked ?? {});
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      void load();
    }
  }, [open, load]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(needle))
    : items;

  function pick(product: CreemProductOption) {
    if (linked[product.id] || product.status === "archived") return;
    onSelect(product);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="wdialog wlib-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Creem · {mode}</span>
          <h2>Creem products</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="wdialog-body wlib-body">
        <div className="wlib-toolbar">
          <label className="wlib-search">
            <SearchIcon />
            <span className="visually-hidden">Search Creem products</span>
            <input
              type="search"
              value={query}
              placeholder="Search by name or product ID"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </label>
          <span className="wlib-total">
            {items.length} product{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {loadError ? (
          <p className="wdialog-error wlib-error" role="alert">
            {loadError}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="wlib-empty">
            <strong>
              {loading ? "Loading Creem products…" : query ? `No Creem product matches “${query}”.` : "No products in this Creem environment yet."}
            </strong>
            {loading || query ? null : <span>Create products in the Creem dashboard, then link them to prices here.</span>}
          </div>
        ) : (
          <ul className="wcreem-list" role="listbox" aria-label="Creem products">
            {visible.map((product) => {
              const taken = linked[product.id] ?? null;
              const archived = product.status === "archived";
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="wcreem-item"
                    disabled={Boolean(taken) || archived}
                    title={taken ?? product.name}
                    onClick={() => pick(product)}
                  >
                    <span className="wcreem-main">
                      <span className="wcreem-name">{product.name}</span>
                      <span className="wcreem-meta">
                        {formatAmount(product.amountCents, product.currency)} · {periodLabel(product)}
                        {product.status ? ` · ${product.status}` : ""}
                      </span>
                      <span className="wcreem-id">{product.id}</span>
                    </span>
                    <span className="wcreem-side">
                      {archived ? <span className="wbadge wbadge-missing">Archived</span> : null}
                      {taken ? (
                        <span className="wbadge wbadge-user" title={taken}>
                          In use
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="wdialog-foot wlib-foot">
        <span className="wlib-note">Select one to fill its ID · products another price uses are marked</span>
        <button type="button" className="wbtn wbtn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
