"use client";

import Link, { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import type { ReadinessItem } from "@/lib/product-readiness";
import { Select } from "../../_components/ui";
import type { StoreOption } from "../_record";
import DeleteProductButton from "./delete-product";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", note: "Hidden from the site." },
  { value: "preview", label: "Preview", note: "Shown on the site, cannot be bought." },
  { value: "published", label: "Published", note: "On sale." },
] as const;

/** Where each checklist item is fixed: a tab of this product, or the legal settings. */
const FIX_HREF: Record<ReadinessItem["tab"], (id: string) => string> = {
  general: (id) => `/panel/products/${id}?tab=general`,
  prices: (id) => `/panel/products/${id}?tab=prices`,
  packages: (id) => `/panel/products/${id}?tab=packages`,
  legal: () => "/panel/settings/legal",
};

type Props = {
  productId: string;
  name: string;
  status: string;
  items: ReadinessItem[];
  ready: boolean;
  testMode: boolean;
  stores: StoreOption[];
};

/**
 * Publish tab: the ready-to-sell checklist, the status switch and the
 * product-wide actions (copy to another store, delete). Publishing is only
 * offered once every item is done; the server checks the same list.
 */
export default function PublishPanel({ productId, name, status, items, ready, testMode, stores }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState(stores[0]?.id ?? "");

  async function changeStatus(next: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The status could not be changed.");
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!target) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: target }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The product could not be copied.");
      else setMessage(`Copied to ${stores.find((store) => store.id === target)?.name ?? "the store"} as a draft (/products/${data.slug}). Switch to that store to set its prices and upload its package.`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const done = items.filter((item) => item.ok).length;

  return (
    <div className="wform-grid">
      <div className="wform-main wform-stack">
        <div className="wfield-card">
          <div className="wmedia-head">
            <p className="wsection-label">Ready to sell</p>
            <span className={`wbadge ${ready ? "wbadge-verified" : "wbadge-pending"}`}>
              {done} / {items.length}
            </span>
          </div>
          <ul className="wready-list">
            {items.map((item) => (
              <li key={item.key} className={item.ok ? "is-done" : "is-open"}>
                <span className="wready-mark" aria-hidden="true">
                  {item.ok ? "✓" : "•"}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  {item.ok ? null : <small>{item.hint}</small>}
                </span>
                {item.ok ? null : (
                  <Link className="wbtn wbtn-ghost wbtn-sm" href={FIX_HREF[item.tab](productId)}>
                    Fix
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {testMode ? (
            <p className="wfield-hint-block">Creem test mode: prices on sale can be test-purchased on previews too; publishing still needs every item.</p>
          ) : null}
        </div>
      </div>

      <div className="wform-side">
        <div className="wfield-card">
          <p className="wsection-label">Status</p>
          <div className="wstatus-choice" role="radiogroup" aria-label="Product status">
            {STATUS_OPTIONS.map((option) => {
              const blocked = option.value === "published" && !ready;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={status === option.value}
                  className={`wstatus-option${status === option.value ? " is-active" : ""}`}
                  disabled={busy || blocked || status === option.value}
                  title={blocked ? "Complete the checklist first." : undefined}
                  onClick={() => changeStatus(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                </button>
              );
            })}
          </div>
        </div>

        {stores.length > 0 ? (
          <div className="wfield-card">
            <p className="wsection-label">Sell in another store</p>
            <div className="wform">
              <Select id="copy-store" label="Store" value={target} onChange={setTarget} options={stores.map((store) => ({ value: store.id, label: store.name }))} />
              <p className="wfield-hint-block">Creates a draft copy there with the content, images, changelog and prices as drafts. Prices and the package are set up in that store.</p>
            </div>
            <div className="wpub-actions">
              <button type="button" className="wbtn wbtn-ghost" onClick={copy} disabled={busy || !target}>
                Copy to store
              </button>
            </div>
          </div>
        ) : null}

        <div className="wfield-card">
          <p className="wsection-label">Danger zone</p>
          <DeleteProductButton productId={productId} name={name} />
        </div>

        {error ? (
          <p className="wdialog-error wpost-feedback" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="wfield-hint-block wpost-feedback" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
