"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** Curated categorical palette; the brand indigo leads. */
const PRESETS = [
  "#4353e8", "#2563eb", "#0ea5e9", "#0d9488", "#16a34a", "#65a30d",
  "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#475569",
];

type Hsva = { h: number; s: number; v: number; a: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Accepts #RGB-order hex with an optional alpha pair (#RRGGBB or #RRGGBBAA). */
export function hexToHsva(hex: string): Hsva {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  const alpha = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { h, s: max === 0 ? 0 : delta / max, v: max, a: alpha };
}

/** Emits #RRGGBB when fully opaque, #RRGGBBAA otherwise. */
export function hsvaToHex({ h, s, v, a }: Hsva): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a >= 1 ? base : `${base}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

function hexToRgbChannels(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
};

/**
 * Custom color picker: saturation/value area, hue track, opacity track,
 * hex input and presets — replaces the native color input popup.
 */
export default function ColorField({ label, value, onChange }: Props) {
  const hexId = useId();
  const [hsva, setHsva] = useState<Hsva>(() => hexToHsva(value || "#4353e8"));
  const [draft, setDraft] = useState(value);
  // Pointer handlers fire faster than re-renders; read the latest state from a ref.
  const hsvaRef = useRef(hsva);
  hsvaRef.current = hsva;

  function apply(next: Hsva) {
    setHsva(next);
    onChange(hsvaToHex(next));
  }

  function areaHandlers(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    apply({ ...hsvaRef.current, s, v });
  }

  function hueHandlers(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const h = clamp(((event.clientX - rect.left) / rect.width) * 360, 0, 360);
    apply({ ...hsvaRef.current, h });
  }

  function alphaHandlers(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const a = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    apply({ ...hsvaRef.current, a });
  }

  function onAreaKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const current = hsvaRef.current;
    if (event.key === "ArrowLeft") apply({ ...current, s: clamp(current.s - step, 0, 1) });
    else if (event.key === "ArrowRight") apply({ ...current, s: clamp(current.s + step, 0, 1) });
    else if (event.key === "ArrowUp") apply({ ...current, v: clamp(current.v + step, 0, 1) });
    else if (event.key === "ArrowDown") apply({ ...current, v: clamp(current.v - step, 0, 1) });
    else return;
    event.preventDefault();
  }

  function onTrackKeyDown(get: () => number, set: (next: number) => Hsva) {
    return (event: KeyboardEvent<HTMLDivElement>) => {
      const current = hsvaRef.current;
      if (event.key === "ArrowLeft") apply(set(get() - 6));
      else if (event.key === "ArrowRight") apply(set(get() + 6));
      else return;
      event.preventDefault();
    };
  }

  function onHexChange(next: string) {
    setDraft(next);
    const match = /^#?([0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/.exec(next.trim());
    if (match) onChange(`#${match[1]!.toLowerCase()}`);
  }

  const solid = hsvaToHex({ ...hsva, a: 1 });
  const { r, g, b } = hexToRgbChannels(solid);

  return (
    <div className="wcolor">
      <label className="wcolor-label" htmlFor={hexId}>
        {label}
        <span className="wfield-hint">pick a color or enter a hex code</span>
      </label>

      <div
        className="wcolor-area"
        role="slider"
        aria-label={`${label} saturation and brightness`}
        aria-valuetext={`Saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((hsva.s + hsva.v) / 2) * 100)}
        tabIndex={0}
        style={{
          backgroundColor: `hsl(${hsva.h} 100% 50%)`,
          backgroundImage:
            "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          areaHandlers(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons & 1) areaHandlers(event);
        }}
        onKeyDown={onAreaKeyDown}
      >
        <span
          className="wcolor-thumb"
          style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
        />
      </div>

      <div
        className="wcolor-hue"
        role="slider"
        aria-label={`${label} hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsva.h)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          hueHandlers(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons & 1) hueHandlers(event);
        }}
        onKeyDown={onTrackKeyDown(
          () => hsvaRef.current.h,
          (h) => ({ ...hsvaRef.current, h: (h + 360) % 360 }),
        )}
      >
        <span className="wcolor-thumb" style={{ left: `${(hsva.h / 360) * 100}%`, top: "50%" }} />
      </div>

      <div className="wcolor-track-head" aria-hidden="true">
        <span>Opacity</span>
        <span>{Math.round(hsva.a * 100)}%</span>
      </div>
      <div
        className="wcolor-alpha"
        role="slider"
        aria-label={`${label} opacity`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsva.a * 100)}
        aria-valuetext={`${Math.round(hsva.a * 100)}% opacity`}
        tabIndex={0}
        style={{
          backgroundImage: `linear-gradient(to right, rgba(${r},${g},${b},0), rgb(${r},${g},${b})), repeating-conic-gradient(#e3e7e6 0% 25%, #fff 0% 50%)`,
          backgroundSize: "100% 100%, 12px 12px",
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          alphaHandlers(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons & 1) alphaHandlers(event);
        }}
        onKeyDown={onTrackKeyDown(
          () => hsvaRef.current.a * 360,
          (hRaw) => ({ ...hsvaRef.current, a: clamp(hRaw / 360, 0, 1) }),
        )}
      >
        <span className="wcolor-thumb" style={{ left: `${hsva.a * 100}%`, top: "50%" }} />
      </div>

      <div className="wcolor-row">
        <span className="wcolor-preview" style={{ background: value }} aria-hidden="true" />
        <input
          id={hexId}
          className="wcolor-hex"
          type="text"
          value={draft}
          maxLength={9}
          spellCheck={false}
          onChange={(event) => onHexChange(event.target.value)}
          onBlur={() => setDraft(value.toUpperCase())}
          placeholder="#4353e8"
        />
      </div>

      <div className="wcolor-presets" role="group" aria-label={`${label} presets`}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="wcolor-swatch"
            style={{ background: preset }}
            aria-label={preset}
            aria-pressed={value.toLowerCase().startsWith(preset.toLowerCase())}
            onClick={() => {
              // Presets reset to fully opaque; the area/hue keep the current opacity.
              setHsva({ ...hexToHsva(preset), a: 1 });
              setDraft(preset);
              onChange(preset);
            }}
          />
        ))}
      </div>
    </div>
  );
}
