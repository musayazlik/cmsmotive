"use client";

import { useId } from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Longer helper text rendered under the label. */
  note?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/** Custom-drawn checkbox so the panel controls all share one look. */
export default function CheckBox({ checked, onChange, label, note, disabled, id, className }: Props) {
  const fieldId = id ?? useId();

  return (
    <div className={["wcheck", className, disabled ? "is-disabled" : null].filter(Boolean).join(" ")}>
      <input
        id={fieldId}
        type="checkbox"
        className="wcheck-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={fieldId} className="wcheck-row">
        <span className="wcheck-box" aria-hidden="true">
          <svg viewBox="0 0 12 12">
            <path d="M2.5 6.4 5 8.9l4.5-5.8" />
          </svg>
        </span>
        <span className="wcheck-text">
          <span className="wcheck-label">{label}</span>
          {note ? <span className="wcheck-note">{note}</span> : null}
        </span>
      </label>
    </div>
  );
}
