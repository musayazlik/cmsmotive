"use client";

import { useId } from "react";
import { FieldShell } from "./field";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hideLabel?: boolean;
  hint?: string;
  note?: string;
  error?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  /** "line" is the compact single-line summary style used in catalog forms. */
  variant?: "multi" | "line";
  disabled?: boolean;
  id?: string;
};

export default function TextArea(props: Props) {
  const {
    value, onChange, label, hideLabel, hint, note, error, disabled,
    maxLength, rows = 4, variant = "multi", id, ...rest
  } = props;
  const fieldId = id ?? useId();

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      note={note}
      error={error}
      disabled={disabled}
      className={variant === "line" ? "wfield-line" : undefined}
    >
      <textarea
        {...rest}
        id={fieldId}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {maxLength ? (
        <p className="wfield-hint-block">
          {value.length}/{maxLength}
        </p>
      ) : null}
    </FieldShell>
  );
}
