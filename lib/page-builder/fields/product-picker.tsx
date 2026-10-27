"use client";

import { useEffect, useId, useState } from "react";

type ProductOption = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
};

export function ProductPicker({
  value = "",
  onChange,
  label = "Select Product",
}: {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/admin/products?pageSize=100")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load products");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setProducts(
          items.map((item: any) => ({
            id: String(item.id),
            slug: String(item.slug),
            name: String(item.name),
            category: item.category ? String(item.category) : null,
          })),
        );
      })
      .catch(() => {
        if (active) setManualMode(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="pb-field-group" style={{ display: "grid", gap: 6, margin: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label htmlFor={id} style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-muted)" }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setManualMode((prev) => !prev)}
          style={{
            background: "none",
            border: "none",
            color: "var(--indigo, #4353e8)",
            fontSize: "0.75rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {manualMode ? "List mode" : "Slug mode"}
        </button>
      </div>

      {manualMode ? (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Product slug (e.g. modern-shop)"
          style={{
            padding: "6px 10px",
            fontSize: "0.85rem",
            border: "1px solid var(--line, #cbd2d3)",
            borderRadius: 6,
            background: "var(--surface, #fff)",
          }}
        />
      ) : (
        <select
          id={id}
          value={value}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: "6px 10px",
            fontSize: "0.85rem",
            border: "1px solid var(--line, #cbd2d3)",
            borderRadius: 6,
            background: "var(--surface, #fff)",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          <option value="">{loading ? "Loading products..." : "-- Choose a product --"}</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.slug})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
