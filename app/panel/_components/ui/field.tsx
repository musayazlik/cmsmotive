"use client";

import type { Ref, ReactNode } from "react";

export type FieldProps = {
  id?: string;
  label: string;
  /** Keeps the label for screen readers but out of sight — used for toolbar filters. */
  hideLabel?: boolean;
  /** Short hint rendered inline after the label text. */
  hint?: string;
  /** Longer helper text rendered as a block under the control. */
  note?: string;
  error?: string;
  disabled?: boolean;
};

type ShellProps = FieldProps & {
  fieldRef?: Ref<HTMLDivElement>;
  /** Extra class on the wrapper, e.g. wui-anchor for popovers or wfield-line. */
  className?: string;
  children: ReactNode;
};

/** Shared label + hint + error wrapper so every panel control reads the same. */
export function FieldShell({ id, label, hideLabel, hint, note, error, disabled, fieldRef, className, children }: ShellProps) {
  return (
    <div
      ref={fieldRef}
      className={["wfield", className, disabled ? "is-disabled" : null].filter(Boolean).join(" ")}
    >
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : undefined}>
        {label}
        {hint ? <span className="wfield-hint">{hint}</span> : null}
      </label>
      {children}
      {note ? <p className="wfield-hint-block">{note}</p> : null}
      {error ? (
        <p className="wfield-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
