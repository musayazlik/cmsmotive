"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldShell } from "./field";

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Local-time ISO date; toISOString would shift the day across time zones. */
export function toISO(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISO(value: string): Date | null {
  if (!ISO_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Props = {
  /** ISO date (YYYY-MM-DD) or an empty string. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  hideLabel?: boolean;
  hint?: string;
  note?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export default function DatePicker({
  value, onChange, label, hideLabel, hint, note, error, placeholder = "YYYY-MM-DD", disabled, id,
}: Props) {
  const fieldId = id ?? useId();
  const popId = `${fieldId}-cal`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipFocus = useRef(false);

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [draft, setDraft] = useState(value);
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openCalendar() {
    if (disabled) return;
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    const rect = inputRef.current?.getBoundingClientRect();
    setDropUp(rect !== undefined && window.innerHeight - rect.bottom < 330 && rect.top > 330);
    const current = parseISO(value) ?? new Date();
    setView({ year: current.getFullYear(), month: current.getMonth() });
    setOpen(true);
  }

  function pick(date: Date) {
    skipFocus.current = true;
    window.setTimeout(() => {
      skipFocus.current = false;
    }, 0);
    onChange(toISO(date));
    setOpen(false);
    inputRef.current?.focus();
  }

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      openCalendar();
    }
  }

  const first = new Date(view.year, view.month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(view.year, view.month, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDate = parseISO(value);
  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(first);

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
      <span className="wui-date-wrap">
        <input
          ref={inputRef}
          id={fieldId}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const parsed = parseISO(text);
            if (parsed) onChange(toISO(parsed));
          }}
          onBlur={() => setDraft(value)}
          onFocus={openCalendar}
          onClick={openCalendar}
          onKeyDown={onInputKeyDown}
        />
        <button
          type="button"
          className="wui-date-icon"
          aria-label="Open calendar"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="5" width="14" height="12" rx="2" />
            <path d="M3 9h14M7 3v4M13 3v4" />
          </svg>
        </button>

        {open ? (
          <div className={["wui-cal", dropUp ? "is-up" : null].filter(Boolean).join(" ")} id={popId} role="dialog" aria-label={`Choose a date for ${label}`}>
            <div className="wui-cal-head">
              <button type="button" className="wui-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <span className="wui-cal-title">{monthLabel}</span>
              <button type="button" className="wui-cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                ›
              </button>
            </div>
            <div className="wui-cal-grid">
              {WEEKDAYS.map((day) => (
                <span key={day} className="wui-cal-dow">
                  {day}
                </span>
              ))}
              {cells.map((date, index) =>
                date ? (
                  <button
                    key={toISO(date)}
                    type="button"
                    className={["wui-cal-day", selectedDate && sameDay(date, selectedDate) ? "is-selected" : null, sameDay(date, today) ? "is-today" : null]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => pick(date)}
                  >
                    {date.getDate()}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                ),
              )}
            </div>
            <div className="wui-cal-foot">
              <button type="button" onClick={() => pick(new Date())}>
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                None
              </button>
            </div>
          </div>
        ) : null}
      </span>
    </FieldShell>
  );
}
