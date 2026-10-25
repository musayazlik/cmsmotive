"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import {
  BILLING_INTERVALS,
  BILLING_TYPES,
  CURRENCIES,
  INTERVAL_LABELS,
  PRICE_LIMITS,
  TAX_MODES,
  describeBilling,
  formatAmount,
} from "@/lib/prices";
import ConfirmDialog from "../../_components/confirm-dialog";
import { Select, Switch, TextArea, TextField } from "../../_components/ui";

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
  creemTestProductId: string | null;
  creemLiveProductId: string | null;
  enabled: boolean;
  position: number;
  /** Whether any order or subscription used it; its terms are then frozen. */
  sold: boolean;
};

type Props = {
  productId: string;
  prices: PriceRow[];
  /** The active Creem environment; the matching product ID is verified before a price can go live. */
  mode: string;
  configured: boolean;
};

const INTERVAL_OPTIONS = BILLING_INTERVALS.map((value) => ({ value, label: `${INTERVAL_LABELS[value].adjective} (every ${INTERVAL_LABELS[value].per})` }));

/** Pricing tab: the buy options of one product in the edited store. */
export default function PriceManager({ productId, prices, mode, configured }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [name, setName] = useState("");
  const [billingType, setBillingType] = useState<string>("onetime");
  const [interval, setInterval] = useState<string>("year");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [taxMode, setTaxMode] = useState("inclusive");
  const [updatesMonths, setUpdatesMonths] = useState("");
  const [seats, setSeats] = useState("1");
  const [features, setFeatures] = useState("");
  const [testId, setTestId] = useState("");
  const [liveId, setLiveId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState("0");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PriceRow | null>(null);

  const fresh = () => {
    setEditing(null);
    setName("");
    setBillingType("onetime");
    setInterval("year");
    setAmount("");
    setCurrency("EUR");
    setTaxMode("inclusive");
    setUpdatesMonths("");
    setSeats("1");
    setFeatures("");
    setTestId("");
    setLiveId("");
    setEnabled(false);
    setPosition("0");
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
    setTestId(price.creemTestProductId ?? "");
    setLiveId(price.creemLiveProductId ?? "");
    setEnabled(price.enabled);
    setPosition(String(price.position));
    setError("");
    setSaved("");
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    const payload = {
      name,
      billingType,
      interval: billingType === "recurring" ? interval : null,
      amountCents: Math.round(Number(amount) * 100),
      currency,
      taxMode,
      updatesMonths: billingType === "onetime" && updatesMonths.trim() ? Number(updatesMonths) : null,
      seats: Number(seats),
      features,
      creemTestProductId: testId.trim() || null,
      creemLiveProductId: liveId.trim() || null,
      enabled,
      position: position.trim() === "" ? 0 : Number(position),
    };
    try {
      const response = await fetch(editing ? `/api/admin/prices/${editing.id}` : `/api/admin/products/${productId}/prices`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The price could not be saved.");
        return;
      }
      setSaved(editing ? "Price saved." : "Price added.");
      fresh();
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
      if (!response.ok) setError(data.error ?? "The price could not be deleted.");
      else {
        if (editing?.id === confirmDelete.id) fresh();
        setSaved("Price removed.");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  }

  const remoteId = mode === "prod" ? liveId : testId;
  const sold = editing?.sold ?? false;

  return (
    <div className="wform-stack">
      <div className="wfield-card">
        <p className="wsection-label">Creem / {mode}</p>
        <p className="wfield-hint-block">
          {configured
            ? `Every price maps 1:1 to a Creem product of the ${mode} environment: one amount, currency and billing period. An enabled price is verified against Creem before it can be bought.`
            : "Add CREEM_API_KEY and CREEM_WEBHOOK_SECRET in the server environment. Prices can be drafted, but nothing can be bought until Creem is configured."}
        </p>
      </div>

      <form className="wfield-card" onSubmit={handleSubmit}>
        <div className="wmedia-head">
          <p className="wsection-label">{editing ? `Edit “${editing.name}”` : "Add a price"}</p>
          {editing ? (
            <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={fresh} disabled={saving}>
              New price
            </button>
          ) : null}
        </div>
        <div className="wform">
          <div className="wfield-row">
            <TextField id="pr-name" label="Label" value={name} onChange={setName} required maxLength={PRICE_LIMITS.name} placeholder="Single site" note="Shown in the buy panel, e.g. “Single site” or “Agency”." />
            <Select
              id="pr-billing"
              label="Billing"
              value={billingType}
              onChange={(next) => {
                setBillingType(next);
                setError("");
              }}
              options={BILLING_TYPES.map((value) => ({ value, label: value === "onetime" ? "One-time" : "Subscription" }))}
              disabled={sold}
              note={sold ? "This price has been sold, so its terms cannot change. Add a new price instead." : undefined}
            />
            {billingType === "recurring" ? <Select id="pr-interval" label="Renews" value={interval} onChange={setInterval} options={INTERVAL_OPTIONS} disabled={sold} /> : null}
          </div>
          <div className="wfield-row">
            <TextField
              id="pr-amount"
              label="Amount"
              value={amount}
              onChange={setAmount}
              required
              pattern="[0-9]+([.,][0-9]{1,2})?"
              placeholder="269"
              disabled={sold}
              note="In the currency below, tax handling next to it."
            />
            <Select id="pr-currency" label="Currency" value={currency} onChange={setCurrency} options={[...CURRENCIES]} disabled={sold} />
            <Select id="pr-tax" label="Tax" value={taxMode} onChange={setTaxMode} options={[...TAX_MODES]} disabled={sold} note="inclusive = VAT included in the amount." />
          </div>
          <div className="wfield-row">
            {billingType === "onetime" ? (
              <TextField
                id="pr-updates"
                label="Included updates"
                hint="months"
                value={updatesMonths}
                onChange={setUpdatesMonths}
                pattern="[0-9]*"
                placeholder="12"
                note="Empty = lifetime updates. Subscriptions always include the active period."
              />
            ) : null}
            <TextField id="pr-seats" label="Installations covered" value={seats} onChange={setSeats} pattern="[0-9]*" note="Support and licence keys cover this many installations." />
            <TextField id="pr-position" label="Sort order" value={position} onChange={setPosition} pattern="[0-9]*" note="Lower numbers come first in the buy panel." />
          </div>
          <TextArea
            id="pr-features"
            label="Feature lines"
            hint="one per line"
            value={features}
            onChange={setFeatures}
            rows={3}
            placeholder={"1 year of updates\nPriority support"}
            note={`Up to ${PRICE_LIMITS.features} lines listed under the price.`}
          />
          <div className="wfield-row">
            <TextField id="pr-test" label="Creem test product ID" value={testId} onChange={setTestId} placeholder="prod_…" disabled={sold} />
            <TextField id="pr-live" label="Creem live product ID" value={liveId} onChange={setLiveId} placeholder="prod_…" disabled={sold} />
          </div>
          <Switch id="pr-enabled" label="Buyable" checked={enabled} onChange={setEnabled} note={remoteId ? undefined : `Add the ${mode} product ID above before enabling.`} />
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

      <div className="wfield-card">
        <p className="wsection-label">Prices of this store</p>
        {prices.length === 0 ? (
          <p className="wrepeat-empty">No prices yet. While a product has no prices, its indicative price from the content tab is shown instead.</p>
        ) : (
          <div className="wrepeat wrepeat-table" role="table" aria-label="Prices">
            <div className="wrepeat-head" role="row">
              <span role="columnheader">Price</span>
              <span role="columnheader">Terms</span>
              <span role="columnheader">Creem</span>
              <span role="columnheader">State</span>
              <span aria-hidden="true" />
            </div>
            {prices.map((price) => (
              <div className="wrepeat-row" role="row" key={price.id}>
                <span role="cell">
                  <strong>{price.name}</strong>
                  <small>{formatAmount(price.amountCents, price.currency)}</small>
                </span>
                <span role="cell">
                  <small>{describeBilling(price)}</small>
                  <small>
                    {price.seats} installation{price.seats === 1 ? "" : "s"}
                  </small>
                </span>
                <span role="cell">
                  <small className="status-slug">{(mode === "prod" ? price.creemLiveProductId : price.creemTestProductId) ?? "—"}</small>
                </span>
                <span role="cell">
                  <span className={`wbadge ${price.enabled ? "wbadge-verified" : "wbadge-missing"}`}>{price.enabled ? "Buyable" : "Concept"}</span>
                  {price.sold ? <span className="wbadge wbadge-user">sold</span> : null}
                </span>
                <div className="wrepeat-tools">
                  <button type="button" onClick={() => startEdit(price)} aria-label={`Edit ${price.name}`}>
                    ✎
                  </button>
                  <button type="button" className="is-danger" onClick={() => setConfirmDelete(price)} aria-label={`Remove ${price.name}`}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="wfield-hint-block">
          A sold price keeps its terms forever so past invoices stay truthful. Disable it and add a new price for changed terms.
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Remove ${confirmDelete?.name ?? "price"}?`}
        body="Prices that were never sold are removed. Sold prices must stay; disable them instead."
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
