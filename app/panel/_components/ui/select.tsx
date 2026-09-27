"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FieldShell } from "./field";

export type SelectOption = { value: string; label: string };

export function toOptions(values: readonly (string | SelectOption)[]): SelectOption[] {
  return values.map((entry) => (typeof entry === "string" ? { value: entry, label: entry } : entry));
}

/** Jumps the highlight to the first option whose label starts with the typed run of keys. */
export function typeaheadIndex(options: SelectOption[], from: number, buffer: string) {
  const needle = buffer.toLocaleLowerCase();
  for (let step = 0; step < options.length; step += 1) {
    const index = (from + step) % options.length;
    if (options[index].label.toLocaleLowerCase().startsWith(needle)) return index;
  }
  return -1;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | SelectOption)[];
  label: string;
  hideLabel?: boolean;
  hint?: string;
  note?: string;
  error?: string;
  /** Shown while no value is selected — the filter style. */
  placeholder?: string;
  /** Offered as the first entry so an empty value can be picked again. */
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
};

export default function Select({
  value, onChange, options, label, hideLabel, hint, note, error, placeholder, emptyLabel, disabled, id,
}: Props) {
  const normalized = useMemo(() => toOptions(options), [options]);
  const fieldId = id ?? useId();
  const listId = `${fieldId}-list`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeahead = useRef({ buffer: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);

  const selected = normalized.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus follows the highlighted option while the list is open.
  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  function openList() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    setDropUp(rect !== undefined && window.innerHeight - rect.bottom < 248 && rect.top > 248);
    setActive(Math.max(0, normalized.findIndex((option) => option.value === value)));
    typeahead.current = { buffer: "", at: 0 };
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: string) {
    onChange(next);
    closeList();
  }

  function move(from: number, delta: number) {
    setActive((from + delta + normalized.length) % normalized.length);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    // While open the focus sits on the option buttons, so the trigger only
    // handles the closed state.
    if (open || disabled) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  function onOptionKeyDown(event: React.KeyboardEvent, index: number) {
    const now = Date.now();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(normalized.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(normalized[index].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const state = typeahead.current;
      const buffer = now - state.at > 600 ? event.key : state.buffer + event.key;
      const hit = typeaheadIndex(normalized, index, buffer);
      typeahead.current = { buffer, at: now };
      if (hit >= 0 && hit !== index) {
        event.preventDefault();
        setActive(hit);
      }
    }
  }

  const listOptions = emptyLabel ? [{ value: "", label: emptyLabel }, ...normalized] : normalized;

  return (
    <FieldShell
      fieldRef={rootRef}
      id={fieldId}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      note={note}
      error={error}
      disabled={disabled}
      className="wui-anchor"
    >
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        className={["wui-trigger", selected ? null : "is-placeholder"].filter(Boolean).join(" ")}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
      >
        <span className="wui-trigger-label">{selected?.label ?? placeholder ?? "Select…"}</span>
        <svg className="wui-chevron" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className={["wui-pop", dropUp ? "is-up" : null].filter(Boolean).join(" ")}>
          <ul className="wui-options" role="listbox" id={listId} aria-label={label}>
            {listOptions.map((option, index) => (
              <li key={option.value || "__empty"} role="presentation">
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className="wui-option"
                  tabIndex={-1}
                  onClick={() => choose(option.value)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="wui-option-label">{option.label}</span>
                  {option.value === value ? (
                    <span className="wui-option-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FieldShell>
  );
}
