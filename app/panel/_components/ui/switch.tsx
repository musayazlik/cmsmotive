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
};

/**
 * An on/off switch, the panel's variant of the checkbox for single toggles.
 * Same API and look as CheckBox, but drawn as a sliding track.
 */
export default function Switch({ checked, onChange, label, note, disabled, id }: Props) {
  const fieldId = id ?? useId();

  return (
    <div className={["wswitch", disabled ? "is-disabled" : null].filter(Boolean).join(" ")}>
      <input
        id={fieldId}
        type="checkbox"
        role="switch"
        className="wswitch-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={fieldId} className="wswitch-row">
        <span className="wswitch-track" aria-hidden="true" />
        <span className="wswitch-text">
          <span className="wswitch-label">{label}</span>
          {note ? <span className="wswitch-note">{note}</span> : null}
        </span>
      </label>
    </div>
  );
}
