"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import type { ProductCompliance } from "@/lib/product-compliance";
import ProductComplianceFields from "../../_components/product-compliance-fields";

/** Packages tab: the checklist that describes what customers receive (licence, notices, tested versions, support). */
export default function PackageChecklist({ productId, value }: { productId: string; value: ProductCompliance }) {
  const router = useRouter();
  const [compliance, setCompliance] = useState(value);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/compliance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compliance }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The checklist could not be saved.");
        return;
      }
      setSaved("Checklist saved.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="wform-stack" onSubmit={handleSubmit}>
      <ProductComplianceFields value={compliance} onChange={setCompliance} />
      <div className="wpub-actions">
        <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save checklist"}
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
