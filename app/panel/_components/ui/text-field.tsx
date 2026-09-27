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
  type?: "text" | "email" | "password" | "search" | "url";
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  disabled?: boolean;
  id?: string;
};

export default function TextField(props: Props) {
  const { value, onChange, label, hideLabel, hint, note, error, disabled, type = "text", id, ...input } = props;
  const fieldId = id ?? useId();

  return (
    <FieldShell id={fieldId} label={label} hideLabel={hideLabel} hint={hint} note={note} error={error} disabled={disabled}>
      <input
        {...input}
        id={fieldId}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
