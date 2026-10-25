"use client";

import type { ReactNode } from "react";
import { DETAIL_LIMITS } from "@/lib/catalog-guard";

export type CompatibilityDraft = { area: string; target: string; status: string };

/** Starting rows for an empty compatibility table; every cell stays editable. */
const TYPICAL_COMPATIBILITY: CompatibilityDraft[] = [
  { area: "TYPO3 CMS", target: "13 LTS / 14 LTS", status: "To verify at release" },
  { area: "PHP", target: "8.2+", status: "To verify at release" },
  { area: "Installation", target: "Composer", status: "To verify at release" },
  { area: "Templating", target: "Fluid / TypoScript", status: "To verify at release" },
];

function move<T>(rows: T[], index: number, by: -1 | 1) {
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(index + by, 0, row);
  return next;
}

/** Up / down / remove controls shared by every repeater row. */
function RowTools({ index, count, label, onMove, onRemove }: { index: number; count: number; label: string; onMove: (by: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="wrepeat-tools">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`}>
        ↓
      </button>
      <button type="button" className="is-danger" onClick={onRemove} aria-label={`Remove ${label}`}>
        ×
      </button>
    </div>
  );
}

function Repeater({ title, count, max, hint, empty, onAdd, addLabel, extra, children }: {
  title: string;
  count: number;
  max: number;
  hint: string;
  empty: string;
  onAdd: () => void;
  addLabel: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="wfield-card">
      <div className="wmedia-head">
        <p className="wsection-label">{title}</p>
        <span className="wmedia-count">
          {count} / {max}
        </span>
      </div>
      {count === 0 ? <p className="wrepeat-empty">{empty}</p> : children}
      <div className="wrepeat-actions">
        <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={onAdd} disabled={count >= max}>
          + {addLabel}
        </button>
        {extra}
      </div>
      <p className="wfield-hint-block">{hint}</p>
    </div>
  );
}

/** The compatibility tab's table: one row per area with its target and status. */
export function CompatibilityEditor({ rows, onChange }: { rows: CompatibilityDraft[]; onChange: (rows: CompatibilityDraft[]) => void }) {
  const update = (index: number, patch: Partial<CompatibilityDraft>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const max = DETAIL_LIMITS.compatibilityRows;
  const cell = DETAIL_LIMITS.compatibilityCell;

  return (
    <Repeater
      title="Compatibility"
      count={rows.length}
      max={max}
      empty="No compatibility rows yet. The Compatibility tab is hidden on the site until you add one."
      onAdd={() => onChange([...rows, { area: "", target: "", status: "" }])}
      addLabel="Add row"
      extra={
        rows.length === 0 ? (
          <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={() => onChange(TYPICAL_COMPATIBILITY)}>
            Start with typical rows
          </button>
        ) : null
      }
      hint="Shown as a table in the Compatibility tab of the detail page, in this order. Empty rows are ignored."
    >
      <div className="wrepeat wrepeat-compat" role="table" aria-label="Compatibility rows">
        <div className="wrepeat-head" role="row">
          <span role="columnheader">Area</span>
          <span role="columnheader">Target</span>
          <span role="columnheader">Status</span>
          <span aria-hidden="true" />
        </div>
        {rows.map((row, index) => (
          <div className="wrepeat-row" role="row" key={index}>
            <input aria-label={`Row ${index + 1} area`} value={row.area} maxLength={cell} placeholder="TYPO3 CMS" onChange={(event) => update(index, { area: event.target.value })} />
            <input aria-label={`Row ${index + 1} target`} value={row.target} maxLength={cell} placeholder="13 LTS / 14 LTS" onChange={(event) => update(index, { target: event.target.value })} />
            <input aria-label={`Row ${index + 1} status`} value={row.status} maxLength={cell} placeholder="Supported" onChange={(event) => update(index, { status: event.target.value })} />
            <RowTools
              index={index}
              count={rows.length}
              label={row.area || `row ${index + 1}`}
              onMove={(by) => onChange(move(rows, index, by))}
              onRemove={() => onChange(rows.filter((_, i) => i !== index))}
            />
          </div>
        ))}
      </div>
    </Repeater>
  );
}
