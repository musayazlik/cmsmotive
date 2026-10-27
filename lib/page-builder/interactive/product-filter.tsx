"use client";

import { useState } from "react";

export function ProductFilter({
  categories,
  targetGridId,
}: {
  categories: string[];
  targetGridId: string;
}) {
  const [selected, setSelected] = useState<string>("all");

  function handleFilter(category: string) {
    setSelected(category);
    const grid = document.getElementById(targetGridId);
    if (!grid) return;
    const cards = grid.querySelectorAll<HTMLElement>("[data-product-category]");
    for (const card of cards) {
      const cardCategory = card.dataset.productCategory;
      if (category === "all" || cardCategory === category) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    }
  }

  if (categories.length <= 1) return null;

  return (
    <div className="product-filter-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
      <button
        type="button"
        className={`filter-pill ${selected === "all" ? "filter-pill--active" : ""}`}
        onClick={() => handleFilter("all")}
        style={{
          padding: "6px 14px",
          borderRadius: 20,
          border: "1px solid var(--line, #cbd2d3)",
          background: selected === "all" ? "var(--indigo, #4353e8)" : "var(--surface, #fff)",
          color: selected === "all" ? "#fff" : "var(--ink, #101418)",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`filter-pill ${selected === cat ? "filter-pill--active" : ""}`}
          onClick={() => handleFilter(cat)}
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid var(--line, #cbd2d3)",
            background: selected === cat ? "var(--indigo, #4353e8)" : "var(--surface, #fff)",
            color: selected === cat ? "#fff" : "var(--ink, #101418)",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
