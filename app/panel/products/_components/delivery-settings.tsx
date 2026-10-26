"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import { DELIVERY_NOTE_LIMIT } from "@/lib/product-compliance";
import { Switch, TextArea } from "../../_components/ui";

type Props = { productId: string; issueLicenseKeys: boolean; deliveryNote: string };

/**
 * Packages tab: what buyers receive besides the ZIP. Keys and the note are
 * delivered by this store after Creem confirms the payment, so nothing has to
 * be set up in the Creem dashboard.
 */
export default function DeliverySettings({ productId, issueLicenseKeys, deliveryNote }: Props) {
  const router = useRouter();
  const [keys, setKeys] = useState(issueLicenseKeys);
  const [note, setNote] = useState(deliveryNote);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/delivery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueLicenseKeys: keys, deliveryNote: note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The delivery settings could not be saved.");
        return;
      }
      setSaved("Delivery settings saved.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="wfield-card" onSubmit={handleSubmit}>
      <p className="wsection-label">Delivery</p>
      <p className="wfield-hint-block wpkg-intro">
        After Creem confirms a payment, the buyer finds everything in their account on this site: the packages above, a
        licence key and your note. Nothing needs to be set up under Delivery in the Creem dashboard.
      </p>
      <div className="wform">
        <Switch
          checked={keys}
          onChange={setKeys}
          label="Issue a licence key with every purchase"
          note="One key per purchase, valid for the installations of the price that was bought. A refund or chargeback revokes it with the downloads."
        />
        <TextArea
          id="delivery-note"
          label="Note for buyers"
          hint="optional"
          value={note}
          onChange={setNote}
          rows={4}
          maxLength={DELIVERY_NOTE_LIMIT}
          placeholder="Setup steps, where to ask for help, what to do with the licence key …"
          note="Plain text, shown in the buyer's account next to the downloads."
        />
      </div>
      <div className="wpub-actions">
        <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save delivery"}
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
  );
}
