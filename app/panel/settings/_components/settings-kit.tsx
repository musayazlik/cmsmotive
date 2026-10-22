"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import type { ActionResult } from "@/app/panel/media/_lib";

/**
 * State for one settings card: edited values, dirty tracking against the
 * saved props and the save round-trip. After a save the page refreshes and
 * the (normalized) saved values replace the edited ones.
 */
export function useSettingsForm<T extends Record<string, unknown>>(
  initial: T,
  action: (values: T) => Promise<ActionResult>,
  options: { refresh?: boolean } = {},
) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    setValues(JSON.parse(initialKey) as T);
  }, [initialKey]);

  const dirty = JSON.stringify(values) !== initialKey;

  function set<K extends keyof T>(key: K, value: T[K]) {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      if (options.refresh !== false) router.refresh();
    });
  }

  return { values, set, dirty, save, pending, saved, error };
}

type Form = Pick<ReturnType<typeof useSettingsForm>, "dirty" | "save" | "pending" | "saved" | "error">;

/** Error line and the save bar at the bottom of a settings card. */
export function SettingsFoot({ form, children }: { form: Form; children?: ReactNode }) {
  return (
    <>
      {form.error ? (
        <p className="wdialog-error" role="alert" style={{ margin: "0 19px 4px" }}>
          {form.error}
        </p>
      ) : null}
      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {form.saved && !form.dirty ? "Settings saved." : ""}
        </span>
        <div className="wsettings-actions">
          {children}
          <button type="button" className="wbtn wbtn-primary" onClick={form.save} disabled={form.pending || !form.dirty}>
            {form.pending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </>
  );
}

/** Labelled slider with its value read out, in the style of the WebP quality control. */
export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  note,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  note?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="wsettings-quality">
      <label htmlFor={id}>{label}</label>
      <div className="wsettings-quality-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="wsettings-quality-value" htmlFor={id}>
          {format(value)}
        </output>
      </div>
      {note ? <p className="wfield-hint-block">{note}</p> : null}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="wbtn wbtn-ghost wcopy-btn" onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}

/** A read-only fact about the environment (configured keys, sender address). */
export function EnvFacts({ facts }: { facts: { label: string; value: string; ok?: boolean }[] }) {
  return (
    <dl className="wtoken-meta">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd className={fact.ok === false ? "is-missing" : undefined}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
