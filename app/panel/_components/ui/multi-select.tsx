"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FieldShell } from "./field";
import { toOptions, typeaheadIndex, type SelectOption } from "./select";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly (string | SelectOption)[];
  label: string;
  hideLabel?: boolean;
  hint?: string;
  note?: string;
  error?: string;
  /** Shown in the trigger while nothing is selected. */
  placeholder?: string;
  /** Chips shown before the "+N more" overflow chip. */
  maxChips?: number;
  disabled?: boolean;
  id?: string;
};

export default function MultiSelect({
  value, onChange, options, label, hideLabel, hint, note, error, placeholder, maxChips = 2, disabled, id,
}: Props) {
  const normalized = useMemo(() => toOptions(options), [options]);
  const fieldId = id ?? useId();
  const listId = `${fieldId}-list`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeahead = useRef({ buffer: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  function openList() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    setDropUp(rect !== undefined && window.innerHeight - rect.bottom < 288 && rect.top > 288);
    setActive(0);
    typeahead.current = { buffer: "", at: 0 };
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggle(next: string) {
    onChange(value.includes(next) ? value.filter((entry) => entry !== next) : [...value, next]);
  }

  function move(from: number, delta: number) {
    setActive((from + delta + normalized.length) % normalized.length);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
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
      toggle(normalized[index].value);
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

  const chips = normalized.filter((option) => value.includes(option.value));

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
      <div
        ref={triggerRef}
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={["wui-trigger", "is-chips", chips.length === 0 ? "is-placeholder" : null].filter(Boolean).join(" ")}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        {chips.length === 0 ? (
          <span className="wui-trigger-label">{placeholder ?? "Any"}</span>
        ) : (
          <>
            {chips.slice(0, maxChips).map((option) => (
              <span className="wui-chip" key={option.value}>
                {option.label}
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(option.value);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  ×
                </button>
              </span>
            ))}
            {chips.length > maxChips ? <span className="wui-more">+{chips.length - maxChips}</span> : null}
          </>
        )}
        <svg className="wui-chevron" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {open ? (
        <div className={["wui-pop", dropUp ? "is-up" : null].filter(Boolean).join(" ")}>
          <div className="wui-pop-head">
            <span>{chips.length} selected</span>
            {chips.length > 0 ? (
              <button type="button" className="wui-pop-clear" onClick={() => onChange([])}>
                Clear
              </button>
            ) : null}
          </div>
          <ul className="wui-options" role="listbox" id={listId} aria-label={label} aria-multiselectable="true">
            {normalized.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={value.includes(option.value)}
                  className="wui-option"
                  tabIndex={-1}
                  onClick={() => toggle(option.value)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="wui-option-check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="wui-option-label">{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FieldShell>
  );
}
