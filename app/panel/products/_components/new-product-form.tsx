"use client";

import Link, { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import { Select, TextArea, TextField } from "../../_components/ui";
import type { ProductTypeOption } from "../_record";

/** Quick create: three fields open a draft; content, prices and packages follow on its tabs. */
export default function NewProductForm({ types }: { types: ProductTypeOption[] }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId, name, summary }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The product could not be created.");
        return;
      }
      router.push(`/panel/products/${data.id}?tab=general`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (types.length === 0) {
    return (
      <div className="wfield-card">
        <p className="wfield-hint-block">There is no product type yet.</p>
        <Link className="wbtn wbtn-primary" href="/panel/products/types">
          Create a product type
        </Link>
      </div>
    );
  }

  return (
    <form className="wfield-card wnew-product" onSubmit={handleSubmit}>
      <div className="wform">
        <Select id="np-type" label="Product type" value={typeId} onChange={setTypeId} options={types.map((type) => ({ value: type.id, label: type.name }))} />
        <TextField id="np-name" label="Name" value={name} onChange={setName} required minLength={2} maxLength={80} placeholder="Nordform" />
        <TextArea id="np-summary" label="Summary" variant="line" value={summary} onChange={setSummary} required minLength={10} maxLength={300} note="One or two sentences for the catalogue card. You can change it later." />
      </div>
      <div className="wpub-actions">
        <button className="wbtn wbtn-primary" type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create draft"}
        </button>
        <Link className="wbtn wbtn-ghost" href="/panel/products">
          Cancel
        </Link>
      </div>
      {error ? (
        <p className="wdialog-error wpost-feedback" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
