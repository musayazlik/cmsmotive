"use client";

import { useMemo, useState } from "react";
import type { AiModelInfo } from "../_ai";

function formatContext(context: number | null): string {
  if (!context) return "";
  return context >= 1000 ? `${Math.round(context / 1000)}k context` : `${context} context`;
}

/** Collapsed trigger + searchable list; native selects choke on 300+ models. */
export default function ModelPicker({
  label,
  models,
  value,
  onChange,
}: {
  label: string;
  models: AiModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const selected = models.find((model) => model.id === value) ?? null;

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) => model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query));
  }, [filter, models]);

  return (
    <div className="wfield">
      <div className="wfield-inline-head">
        <label>{label}</label>
      </div>
      <div className="wai-model">
        <button
          type="button"
          className="wai-model-trigger"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          disabled={models.length === 0}
        >
          <span>
            <strong>{selected?.name ?? "Choose a model"}</strong>
            <small>
              {selected
                ? `${selected.id}${selected.context ? ` · ${formatContext(selected.context)}` : ""}`
                : `${models.length} model${models.length === 1 ? "" : "s"} available`}
            </small>
          </span>
          <span aria-hidden="true" className="wai-model-chevron">
            {expanded ? "▴" : "▾"}
          </span>
        </button>

        {expanded ? (
          <div className="wai-model-list">
            <div className="wai-model-search">
              <label className="visually-hidden" htmlFor={`wai-filter-${label}`}>
                Filter models
              </label>
              <input
                id={`wai-filter-${label}`}
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by name or id…"
                autoFocus
              />
            </div>
            {filtered.map((model) => (
              <button
                type="button"
                key={model.id}
                className={`wai-model-option ${model.id === value ? "is-selected" : ""}`}
                aria-pressed={model.id === value}
                onClick={() => {
                  onChange(model.id);
                  setExpanded(false);
                  setFilter("");
                }}
              >
                <span>
                  <strong>{model.name}</strong>
                  <small>
                    {model.id}
                    {model.context ? ` · ${formatContext(model.context)}` : ""}
                  </small>
                </span>
                {model.free ? (
                  <span className="wai-free">FREE</span>
                ) : model.priceIn !== null ? (
                  <span className="wai-price">${model.priceIn.toFixed(2)}/1M</span>
                ) : null}
              </button>
            ))}
            {filtered.length === 0 ? <p className="wai-model-empty">No models match the filter.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
