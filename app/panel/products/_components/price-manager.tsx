"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import { BILLING_INTERVALS, CURRENCIES, INTERVAL_LABELS, PRICE_LIMITS, TAX_MODES, describeBilling, formatAmount } from "@/lib/prices";
import ConfirmDialog from "../../_components/confirm-dialog";
import { Select, Switch, TextArea, TextField } from "../../_components/ui";
import RowActions from "@/app/panel/_components/row-actions";

/** A price of the product as the edit page loads it. */
export type PriceRow = {
  id: string;
  name: string;
  billingType: string;
  interval: string | null;
  amountCents: number;
  currency: string;
  taxMode: string;
  updatesMonths: number | null;
  seats: number;
  features: string[];
  /** The Creem product of the current payment mode, once created or linked. */
  creemProductId: string | null;
  enabled: boolean;
  position: number;
  /** Whether any order or subscription used it; its terms are then frozen. */
  sold: boolean;
};

type Props = {
  productId: string;
  prices: PriceRow[];
  /** The active Creem environment (test or prod). */
  mode: string;
  configured: boolean;
};

const INTERVAL_OPTIONS = BILLING_INTERVALS.map((value) => ({ value, label: INTERVAL_LABELS[value].adjective }));

/**
 * Prices tab: the ways to buy the product. "On sale" is the only Creem step:
 * saving creates (or updates) the matching Creem product in the current
 * payment mode. Draft prices show on the site as indicative "from" prices.
 */
export default function PriceManager({ productId, prices, mode, configured }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [name, setName] = useState("");
  const [billingType, setBillingType] = useState("onetime");
  const [interval, setInterval] = useState("year");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(prices[0]?.currency ?? "EUR");
  const [taxMode, setTaxMode] = useState("inclusive");
  const [updatesMonths, setUpdatesMonths] = useState("12");
  const [seats, setSeats] = useState("1");
  const [features, setFeatures] = useState("");
  const [position, setPosition] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [linkId, setLinkId] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PriceRow | null>(null);

  const reset = () => {
    setEditing(null);
    setName("");
    setBillingType("onetime");
    setInterval("year");
    setAmount("");
    setTaxMode("inclusive");
    setUpdatesMonths("12");
    setSeats("1");
    setFeatures("");
    setPosition("0");
    setEnabled(true);
    setLinkId("");
  };

  const startEdit = (price: PriceRow) => {
    setEditing(price);
    setName(price.name);
    setBillingType(price.billingType);
    setInterval(price.interval ?? "year");
    setAmount(String(price.amountCents / 100));
    setCurrency(price.currency);
    setTaxMode(price.taxMode);
    setUpdatesMonths(price.updatesMonths === null ? "" : String(price.updatesMonths));
    setSeats(String(price.seats));
    setFeatures(price.features.join("\n"));
    setPosition(String(price.position));
    setEnabled(price.enabled);
    setLinkId("");
    setError("");
    setSaved("");
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(editing ? `/api/admin/prices/${editing.id}` : `/api/admin/products/${productId}/prices`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          billingType,
          interval: billingType === "recurring" ? interval : null,
          amountCents: Math.round(Number(amount.replace(",", ".")) * 100),
          currency,
          taxMode,
          updatesMonths: billingType === "onetime" && updatesMonths.trim() ? Number(updatesMonths) : null,
          seats: Number(seats),
          features,
          position: position.trim() === "" ? 0 : Number(position),
          enabled,
          creemProductId: linkId.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The price could not be saved.");
        router.refresh();
        return;
      }
      setSaved(enabled ? `Saved and on sale (Creem ${mode}).` : "Saved as a draft price.");
      reset();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/prices/${confirmDelete.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The price could not be removed.");
      else {
        if (editing?.id === confirmDelete.id) reset();
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  }

  const sold = editing?.sold ?? false;

  return (
    <div className="wform-stack">
      {!configured ? (
        <p className="wfield-hint-block">
          Creem is not configured (CREEM_API_KEY, CREEM_WEBHOOK_SECRET). Prices can be drafted; nothing can be put on sale yet.
        </p>
      ) : null}

      <div className="wtable-card">
        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Price</th>
                <th scope="col">Amount</th>
                <th scope="col">Terms</th>
                <th scope="col">State</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {prices.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={5}>
                    No prices yet. Add the first one below.
                  </td>
                </tr>
              ) : (
                prices.map((price) => (
                  <tr key={price.id}>
                    <td>
                      <strong>{price.name}</strong>
                    </td>
                    <td>
                      <strong>{formatAmount(price.amountCents, price.currency)}</strong>
                    </td>
                    <td>
                      <small>
                        {describeBilling(price)} · {price.seats} installation{price.seats === 1 ? "" : "s"}
                      </small>
                    </td>
                    <td>
                      <span className={`wbadge ${price.enabled ? "wbadge-verified" : "wbadge-missing"}`}>{price.enabled ? "On sale" : "Draft"}</span>
                      {price.sold ? <span className="wbadge wbadge-user">sold</span> : null}
                    </td>
                    <td className="wtable-actions-col">
                      <RowActions
                        label={price.name}
                        actions={[
                          { label: "Edit", onSelect: () => startEdit(price) },
                          ...(price.sold ? [] : [{ label: "Remove", danger: true, separated: true, onSelect: () => setConfirmDelete(price) }]),
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form className="wfield-card" onSubmit={handleSubmit}>
        <div className="wmedia-head">
          <p className="wsection-label">{editing ? `Edit “${editing.name}”` : "Add a price"}</p>
          {editing ? (
            <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={reset} disabled={saving}>
              Cancel editing
            </button>
          ) : null}
        </div>
        {sold ? <p className="wfield-hint-block">This price has been sold, so its amount and billing are fixed. Add a new price for new terms.</p> : null}
        <div className="wform">
          <div className="wfield-row">
            <TextField id="pr-name" label="Label" value={name} onChange={setName} required maxLength={PRICE_LIMITS.name} placeholder="Single site" />
            <Select
              id="pr-billing"
              label="Billing"
              value={billingType}
              onChange={setBillingType}
              options={[
                { value: "onetime", label: "One-time" },
                { value: "recurring", label: "Subscription" },
              ]}
              disabled={sold}
            />
            {billingType === "recurring" ? <Select id="pr-interval" label="Renews" value={interval} onChange={setInterval} options={INTERVAL_OPTIONS} disabled={sold} /> : null}
          </div>
          <div className="wfield-row">
            <TextField id="pr-amount" label="Amount" value={amount} onChange={setAmount} required pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="269" disabled={sold} />
            <Select id="pr-currency" label="Currency" value={currency} onChange={setCurrency} options={[...CURRENCIES]} disabled={sold} />
            <Select
              id="pr-tax"
              label="Tax"
              value={taxMode}
              onChange={setTaxMode}
              options={TAX_MODES.map((value) => ({ value, label: value === "inclusive" ? "Included" : "Added at checkout" }))}
              disabled={sold}
            />
          </div>
          <div className="wfield-row">
            {billingType === "onetime" ? (
              <TextField id="pr-updates" label="Updates included" hint="months" value={updatesMonths} onChange={setUpdatesMonths} pattern="[0-9]*" note="Empty = lifetime updates." />
            ) : null}
            <TextField id="pr-seats" label="Installations" value={seats} onChange={setSeats} pattern="[0-9]*" />
            <TextField id="pr-position" label="Sort order" value={position} onChange={setPosition} pattern="[0-9]*" />
          </div>
          <TextArea id="pr-features" label="Feature lines" hint="one per line" value={features} onChange={setFeatures} rows={3} placeholder={"1 year of updates\nPriority support"} />
          <Switch
            id="pr-enabled"
            label="On sale"
            checked={enabled}
            onChange={setEnabled}
            disabled={!configured}
            note={`Saving creates or updates the product in Creem (${mode}). Off = a draft shown as an indicative price.`}
          />
          <details className="wdisclosure">
            <summary>Link an existing Creem product instead</summary>
            <TextField
              id="pr-link"
              label={`Creem ${mode} product ID`}
              value={linkId}
              onChange={setLinkId}
              placeholder={editing?.creemProductId ?? "prod_…"}
              disabled={sold}
              note="Only for a product that already exists in Creem; it is updated to these terms."
            />
          </details>
        </div>
        <div className="wpub-actions">
          <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save price" : "Add price"}
          </button>
        </div>
        {error ? (
          <p className="wdialog-error wpost-feedback" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="wfield-hint-block wpost-feedback" role="status">
            {saved}
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Remove ${confirmDelete?.name ?? "price"}?`}
        body="Prices that were never sold are removed. Sold prices stay; take them off sale instead."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
