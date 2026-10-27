"use client";

import { Fragment, useMemo, useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import { BREAKPOINT_WIDTHS, BREAKPOINTS, EDITOR_VIEWPORTS, type DeviceKey } from "./css";
import {
  BG_POSITION_CHOICES,
  BG_REPEAT_CHOICES,
  BG_SIZE_CHOICES,
  BORDER_STYLES,
  BORDER_WIDTH_BOUNDS,
  COLOR_TOKENS,
  DIMENSION_BOUNDS,
  DIMENSION_UNITS,
  FONT_FAMILIES,
  FONT_SIZE_BOUNDS,
  FONT_WEIGHT_STEPS,
  GRADIENT_ANGLE_BOUNDS,
  LENGTH_BOUNDS,
  LENGTH_UNITS,
  LINE_HEIGHT_BOUNDS,
  OVERLAY_OPACITY_BOUNDS,
  RADIUS_BOUNDS,
  SHADOW_CHOICES,
  SHADOW_LABELS,
  SIZE_UNITS,
  TRACKING_BOUNDS,
  TRACKING_UNITS,
  type BgPositionChoice,
  type BgRepeatChoice,
  type BgSizeChoice,
  type BlockStyle,
  type BorderStyleChoice,
  type ColorChoice,
  type CssLength,
  type DimensionLength,
  type FontFamilyChoice,
  type GradientValues,
  type LengthUnit,
  type LetterSpacing,
  type Responsive,
  type ShadowChoice,
  type SpacingValues,
  type TextAlignChoice,
  type TrackingUnit,
  type TypographyValues,
  type VisibilityValues,
} from "./types";

/**
 * The shared "Style" custom field (plan 5.3, Phase 0: typography + spacing).
 * Renders two collapsible groups of structured inputs; values go into
 * `props.style` as typed objects that style/css.ts compiles into scoped CSS.
 *
 * The panel is always scoped to Puck's current viewport: switching the canvas
 * device writes to that device's layer (base → tablet → mobile), matching
 * plan 5.6. All components here are client-side; they must not leak into the
 * server config.
 */

export type StyleFieldParams = {
  /** Prop name ("style"), unused beyond the React tree but kept for debugging. */
  name: string;
  value: BlockStyle | undefined;
  onChange: (value: BlockStyle) => void;
};

/*
 * Selector-based store reads: `usePuck()` without a selector re-renders the
 * panel on every keystroke anywhere in the editor (Puck warns about this).
 * `createUsePuck()` returns a hook that receives the selector per call.
 */
const usePuckApi = createUsePuck();

export function StyleField({ value, onChange }: StyleFieldParams) {
  const viewports = usePuckApi((store) => store.appState.ui.viewports);
  const dispatch = usePuckApi((store) => store.dispatch);
  const device = deviceForViewport(viewports.current.width);

  const commit = (next: BlockStyle) => onChange(next);

  return (
    <div className="pbstyle">
      <div className="pbstyle-devices" role="group" aria-label="Editing screens">
        {EDITOR_VIEWPORTS.map((viewport) => (
          <button
            key={viewport.device}
            type="button"
            className={`pbstyle-device${device === viewport.device ? " is-active" : ""}`}
            aria-pressed={device === viewport.device}
            title={`${viewport.label} (${viewport.width}px) — style edits apply to this layer`}
            onClick={() =>
              dispatch({
                type: "setUi",
                ui: {
                  viewports: { ...viewports, current: { width: viewport.width, height: "auto" } },
                },
              })
            }
          >
            {deviceIcon(viewport.icon)}
            {viewport.label}
          </button>
        ))}
      </div>

      {device !== "base" && (
        <p className="pbstyle-note">
          Values here override the desktop values for screens up to{" "}
          {device === "mobile" ? decode(BREAKPOINTS.mobile) : decode(BREAKPOINTS.tablet)}.
          Leave a field empty to inherit.
        </p>
      )}

      <StyleGroup
        title="Typography"
        device={device}
        group={value?.typography}
        onGroup={(next) => commit({ ...value, typography: next })}
        render={(api) => {
          const { get, set, clear, isSet } = api;
          return (
            <>
            <SelectRow
              label="Font"
              value={get("fontFamily")}
              options={[["", "Auto"], ...FONT_FAMILIES.map((f) => [f.key, f.label] as const)]}
              onSelect={(next) => (next ? set({ fontFamily: next as FontFamilyChoice }) : clear("fontFamily"))}
              isSet={isSet("fontFamily")}
              onClear={() => clear("fontFamily")}
            />
            <Row label="Size" isSet={isSet("fontSize")} onClear={() => clear("fontSize")}>
              <LengthEditor
                a11yLabel="Font size"
                value={get("fontSize")}
                units={[...SIZE_UNITS]}
                bounds={FONT_SIZE_BOUNDS}
                onCommit={(next) => (next ? set({ fontSize: next }) : clear("fontSize"))}
              />
            </Row>
            <SelectRow
              label="Weight"
              value={get("fontWeight")}
              options={[["", "Auto"], ...FONT_WEIGHT_STEPS.map((w) => [String(w), String(w)] as const)]}
              onSelect={(next) =>
                (next ? set({ fontWeight: Number(next) as TypographyValues["fontWeight"] }) : clear("fontWeight"))
              }
              isSet={isSet("fontWeight")}
              onClear={() => clear("fontWeight")}
            />
            <NumberRow
              label="Line height"
              a11yLabel="Line height"
              value={get("lineHeight")}
              step={0.05}
              bounds={LINE_HEIGHT_BOUNDS}
              isSet={isSet("lineHeight")}
              onCommit={(next) => (next ? set({ lineHeight: next }) : clear("lineHeight"))}
              onClear={() => clear("lineHeight")}
            />
            <Row label="Letter spacing" isSet={isSet("letterSpacing")} onClear={() => clear("letterSpacing")}>
              <TrackingEditor
                a11yLabel="Letter spacing"
                value={get("letterSpacing")}
                onCommit={(next) => (next ? set({ letterSpacing: next }) : clear("letterSpacing"))}
              />
            </Row>
            <Row label="Align" isSet={isSet("textAlign")} onClear={() => clear("textAlign")}>
              <AlignControl
                value={get("textAlign")}
                onSelect={(next) => (next ? set({ textAlign: next }) : clear("textAlign"))}
              />
            </Row>
            <Row label="Color" isSet={isSet("textColor")} onClear={() => clear("textColor")}>
              <ColorEditor
                a11yLabel="Text color"
                value={get("textColor")}
                onCommit={(next) => (next ? set({ textColor: next }) : clear("textColor"))}
              />
            </Row>
          </>
          );
        }}
      />

      <StyleGroup
        title="Spacing"
        device={device}
        group={value?.spacing}
        onGroup={(next) => commit({ ...value, spacing: next })}
        render={(api) => {
          const { get, set, clear, isSet } = api;
          return (
            <>
            <EdgeRows
              title="Margin"
              keys={["marginTop", "marginRight", "marginBottom", "marginLeft"]}
              get={get}
              set={set}
              clear={clear}
              isSet={isSet}
            />
            <EdgeRows
              title="Padding"
              keys={["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]}
              get={get}
              set={set}
              clear={clear}
              isSet={isSet}
            />
          </>
          );
        }}
      />

      <StyleGroup
        title="Background"
        device={device}
        group={value?.background}
        onGroup={(next) => commit({ ...value, background: next })}
        render={(api) => {
          const { get, set, clear, isSet } = api;
          return (
            <>
              <Row label="Color" isSet={isSet("color")} onClear={() => clear("color")}>
                <ColorEditor
                  a11yLabel="Background color"
                  value={get("color")}
                  onCommit={(next) => (next ? set({ color: next }) : clear("color"))}
                />
              </Row>
              <Row label="Gradient" isSet={isSet("gradient")} onClear={() => clear("gradient")}>
                <GradientEditor
                  value={get("gradient")}
                  onCommit={(next) => (next ? set({ gradient: next }) : clear("gradient"))}
                />
              </Row>
              <Row label="Image URL" isSet={isSet("image")} onClear={() => clear("image")}>
                <input
                  type="text"
                  className="pbstyle-input"
                  aria-label="Background image URL"
                  placeholder="https://... or /assets/..."
                  value={get("image") ?? ""}
                  onChange={(event) => {
                    const next = event.currentTarget.value.trim();
                    if (next) set({ image: next });
                    else clear("image");
                  }}
                />
              </Row>
              <Row label="Dim color" isSet={isSet("overlayColor")} onClear={() => clear("overlayColor")}>
                <ColorEditor
                  a11yLabel="Dim overlay color"
                  value={get("overlayColor")}
                  onCommit={(next) => (next ? set({ overlayColor: next }) : clear("overlayColor"))}
                />
              </Row>
              <NumberRow
                label="Dim opacity"
                a11yLabel="Dim overlay opacity"
                value={get("overlayOpacity")}
                step={0.05}
                bounds={OVERLAY_OPACITY_BOUNDS}
                isSet={isSet("overlayOpacity")}
                onCommit={(next) => (next === undefined ? clear("overlayOpacity") : set({ overlayOpacity: next }))}
                onClear={() => clear("overlayOpacity")}
              />
              <SelectRow
                label="Size"
                value={get("size")}
                options={[["", "Default"], ...BG_SIZE_CHOICES.map((s) => [s, s] as const)]}
                onSelect={(next) => (next ? set({ size: next as BgSizeChoice }) : clear("size"))}
                isSet={isSet("size")}
                onClear={() => clear("size")}
              />
              <SelectRow
                label="Position"
                value={get("position")}
                options={[["", "Default"], ...BG_POSITION_CHOICES.map((p) => [p, p] as const)]}
                onSelect={(next) => (next ? set({ position: next as BgPositionChoice }) : clear("position"))}
                isSet={isSet("position")}
                onClear={() => clear("position")}
              />
              <SelectRow
                label="Repeat"
                value={get("repeat")}
                options={[["", "Default"], ...BG_REPEAT_CHOICES.map((r) => [r, r] as const)]}
                onSelect={(next) => (next ? set({ repeat: next as BgRepeatChoice }) : clear("repeat"))}
                isSet={isSet("repeat")}
                onClear={() => clear("repeat")}
              />
            </>
          );
        }}
      />

      <StyleGroup
        title="Border"
        device={device}
        group={value?.border}
        onGroup={(next) => commit({ ...value, border: next })}
        render={(api) => {
          const { get, set, clear, isSet } = api;
          return (
            <>
              <Row label="Width" isSet={isSet("width")} onClear={() => clear("width")}>
                <LengthEditor
                  a11yLabel="Border width"
                  value={get("width")}
                  units={[...LENGTH_UNITS]}
                  bounds={BORDER_WIDTH_BOUNDS}
                  onCommit={(next) => (next ? set({ width: next }) : clear("width"))}
                />
              </Row>
              <SelectRow
                label="Style"
                value={get("style")}
                options={[["", "None"], ...BORDER_STYLES.map((s) => [s, s] as const)]}
                onSelect={(next) => (next ? set({ style: next as BorderStyleChoice }) : clear("style"))}
                isSet={isSet("style")}
                onClear={() => clear("style")}
              />
              <Row label="Color" isSet={isSet("color")} onClear={() => clear("color")}>
                <ColorEditor
                  a11yLabel="Border color"
                  value={get("color")}
                  onCommit={(next) => (next ? set({ color: next }) : clear("color"))}
                />
              </Row>
              <Row label="Radius" isSet={isSet("radius")} onClear={() => clear("radius")}>
                <LengthEditor
                  a11yLabel="Border radius"
                  value={get("radius")}
                  units={[...LENGTH_UNITS]}
                  bounds={RADIUS_BOUNDS}
                  onCommit={(next) => (next ? set({ radius: next }) : clear("radius"))}
                />
              </Row>
              <SelectRow
                label="Shadow"
                value={get("shadow")}
                options={[["", "Default (none)"], ...SHADOW_CHOICES.map((s) => [s, SHADOW_LABELS[s]] as const)]}
                onSelect={(next) => (next ? set({ shadow: next as ShadowChoice }) : clear("shadow"))}
                isSet={isSet("shadow")}
                onClear={() => clear("shadow")}
              />
            </>
          );
        }}
      />

      <StyleGroup
        title="Size"
        device={device}
        group={value?.size}
        onGroup={(next) => commit({ ...value, size: next })}
        render={(api) => {
          const { get, set, clear, isSet } = api;
          return (
            <>
              <Row label="Width" isSet={isSet("width")} onClear={() => clear("width")}>
                <LengthEditor
                  a11yLabel="Width"
                  value={get("width")}
                  units={[...DIMENSION_UNITS]}
                  bounds={DIMENSION_BOUNDS}
                  onCommit={(next) => (next ? set({ width: next as DimensionLength }) : clear("width"))}
                />
              </Row>
              <Row label="Max width" isSet={isSet("maxWidth")} onClear={() => clear("maxWidth")}>
                <LengthEditor
                  a11yLabel="Max width"
                  value={get("maxWidth")}
                  units={[...DIMENSION_UNITS]}
                  bounds={DIMENSION_BOUNDS}
                  onCommit={(next) => (next ? set({ maxWidth: next as DimensionLength }) : clear("maxWidth"))}
                />
              </Row>
              <Row label="Min height" isSet={isSet("minHeight")} onClear={() => clear("minHeight")}>
                <LengthEditor
                  a11yLabel="Min height"
                  value={get("minHeight")}
                  units={[...DIMENSION_UNITS]}
                  bounds={DIMENSION_BOUNDS}
                  onCommit={(next) => (next ? set({ minHeight: next as DimensionLength }) : clear("minHeight"))}
                />
              </Row>
              <Row label="Height" isSet={isSet("height")} onClear={() => clear("height")}>
                <LengthEditor
                  a11yLabel="Height"
                  value={get("height")}
                  units={[...DIMENSION_UNITS]}
                  bounds={DIMENSION_BOUNDS}
                  onCommit={(next) => (next ? set({ height: next as DimensionLength }) : clear("height"))}
                />
              </Row>
            </>
          );
        }}
      />

      <VisibilityGroup value={value?.visibility} onCommit={(next) => commit({ ...value, visibility: next })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visibility (flat: the screen bands are disjoint, so no device layering)
// ---------------------------------------------------------------------------

const VISIBILITY_DEVICES = [
  ["desktop", "Hide on desktop", "≥901px"],
  ["tablet", "Hide on tablet", "621–900px"],
  ["mobile", "Hide on mobile", "≤620px"],
] as const satisfies ReadonlyArray<readonly [keyof VisibilityValues, string, string]>;

function VisibilityGroup({
  value,
  onCommit,
}: {
  value: VisibilityValues | undefined;
  onCommit: (next: VisibilityValues | undefined) => void;
}) {
  const count = VISIBILITY_DEVICES.filter(([key]) => value?.[key]).length;
  return (
    <details className="pbstyle-group" open={count > 0}>
      <summary>
        <span className="pbstyle-group-name">Visibility</span>
        {count > 0 && <span className="pbstyle-group-count">{count}</span>}
      </summary>
      <div className="pbstyle-group-body">
        {VISIBILITY_DEVICES.map(([key, label, band]) => (
          <label key={key} className="pbstyle-check">
            <input
              type="checkbox"
              checked={Boolean(value?.[key])}
              onChange={(event) => {
                const next = { ...(value ?? {}) };
                if (event.currentTarget.checked) next[key] = true;
                else delete next[key];
                onCommit(Object.keys(next).length ? next : undefined);
              }}
            />
            <span>
              {label} <small>({band})</small>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Group shell
// ---------------------------------------------------------------------------

type GroupApi<TValues> = {
  get: <K extends keyof TValues>(key: K) => TValues[K] | undefined;
  set: (patch: Partial<TValues>) => void;
  clear: (key: keyof TValues) => void;
  isSet: (key: keyof TValues) => boolean;
};

type StyleGroupProps<TValues extends Record<string, unknown>> = {
  title: string;
  device: DeviceKey;
  group?: Responsive<TValues>;
  onGroup: (next: Responsive<TValues>) => void;
  render: (api: GroupApi<TValues>) => React.ReactNode;
};

function StyleGroup<TValues extends Record<string, unknown>>({
  title,
  device,
  group,
  onGroup,
  render,
}: StyleGroupProps<TValues>) {
  const basePush = (patch: Partial<TValues>) =>
    onGroup({ ...group, base: { ...(group?.base ?? {}), ...patch } } as Responsive<TValues>);
  const layerPush = (patch: Partial<TValues>) => {
    if (device === "base") return basePush(patch);
    const layer = (device === "tablet" ? group?.tablet : group?.mobile) as Partial<TValues> | undefined;
    return onGroup({
      ...group,
      [device]: { ...(layer ?? {}), ...patch },
    } as Responsive<TValues>);
  };

  const read = <K extends keyof TValues>(key: K): TValues[K] | undefined => {
    if (device !== "base") {
      const layer = device === "tablet" ? group?.tablet : group?.mobile;
      if (layer && key in layer && layer[key] !== undefined) return layer[key] as TValues[K];
    }
    return group?.base?.[key];
  };
  const isSetAt = (key: keyof TValues): boolean => {
    if (device !== "base") {
      const layer = device === "tablet" ? group?.tablet : group?.mobile;
      if (layer && key in layer && layer[key] !== undefined) return true;
    }
    return Boolean(group?.base && key in group.base && group.base[key] !== undefined);
  };
  const clearAt = (key: keyof TValues) => {
    if (device === "base") {
      const base = { ...(group?.base ?? {}) } as Partial<TValues>;
      delete base[key];
      return onGroup({ ...group, base } as Responsive<TValues>);
    }
    const layer = { ...((device === "tablet" ? group?.tablet : group?.mobile) ?? {}) } as Partial<TValues>;
    delete layer[key];
    return onGroup({ ...group, [device]: layer } as Responsive<TValues>);
  };

  const count = useMemo(() => countLayerKeys(group), [group]);

  return (
    <details className="pbstyle-group" open={Boolean(count)}>
      <summary>
        <span className="pbstyle-group-name">{title}</span>
        {device !== "base" && <span className="pbstyle-group-device">{device === "tablet" ? "Tablet" : "Mobile"}</span>}
        {count > 0 && <span className="pbstyle-group-count">{count}</span>}
      </summary>
      <div className="pbstyle-group-body">
        {render({ get: read, set: layerPush, clear: clearAt, isSet: isSetAt })}
      </div>
    </details>
  );
}

function countLayerKeys(group: Responsive<Record<string, unknown>> | undefined): number {
  return Object.values(group ?? {}).reduce<number>((total, layer) => total + (layer ? Object.keys(layer).length : 0), 0);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function Row({
  label,
  isSet,
  onClear,
  children,
}: {
  label: string;
  isSet: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pbstyle-row" data-set={isSet ? "true" : "false"}>
      <span className="pbstyle-row-label">{label}</span>
      <div className="pbstyle-row-controls">{children}</div>
      {isSet && (
        <button type="button" className="pbstyle-clear" aria-label={`Clear ${label}`} title={`Clear ${label}`} onClick={onClear}>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SelectRow<V extends string | number | undefined>({
  label,
  value,
  options,
  onSelect,
  isSet,
  onClear,
}: {
  label: string;
  value: V;
  options: Array<readonly [string, string]>;
  onSelect: (value: string) => void;
  isSet: boolean;
  onClear: () => void;
}) {
  return (
    <Row label={label} isSet={isSet} onClear={onClear}>
      <select
        className="pbstyle-select"
        aria-label={label}
        value={value === undefined ? "" : String(value)}
        onChange={(event) => onSelect(event.currentTarget.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Row>
  );
}

function NumberRow({
  label,
  a11yLabel,
  value,
  step,
  bounds,
  isSet,
  onCommit,
  onClear,
}: {
  label: string;
  a11yLabel: string;
  value: number | undefined;
  step: number;
  bounds: { min: number; max: number };
  isSet: boolean;
  onCommit: (value: number | undefined) => void;
  onClear: () => void;
}) {
  return (
    <Row label={label} isSet={isSet} onClear={onClear}>
      <NumberInput
        a11yLabel={a11yLabel}
        value={value}
        step={step}
        min={bounds.min}
        max={bounds.max}
        onCommit={onCommit}
      />
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function NumberInput({
  value,
  step,
  min,
  max,
  a11yLabel,
  onCommit,
}: {
  value: number | undefined;
  step: number;
  min: number;
  max: number;
  a11yLabel: string;
  onCommit: (value: number | undefined) => void;
}) {
  const display = value === undefined ? "" : String(value);
  const commit = (raw: string) => {
    if (raw === "") return onCommit(undefined);
    const next = Number(raw);
    if (Number.isFinite(next)) onCommit(Math.min(max, Math.max(min, next)));
  };
  return (
    <input
      type="number"
      className="pbstyle-input"
      aria-label={a11yLabel}
      value={display}
      step={step}
      min={min}
      max={max}
      onChange={(event) => commit(event.currentTarget.value)}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  );
}

/**
 * Keeps the unit the user last picked even before any number is typed, so a
 * unit switch followed by a number lands with the chosen unit instead of
 * falling back to px.
 */
function UnitPicker({
  a11yLabel,
  units,
  value,
  onPick,
}: {
  a11yLabel: string;
  units: readonly string[];
  value: string | undefined;
  onPick: (unit: string) => void;
}) {
  return (
    <select
      className="pbstyle-unit"
      aria-label={a11yLabel}
      value={value ?? units[0]}
      onChange={(event) => onPick(event.currentTarget.value)}
    >
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}

function LengthEditor<U extends string = LengthUnit>({
  a11yLabel,
  value,
  units,
  bounds,
  onCommit,
}: {
  a11yLabel: string;
  value: { value: number; unit: U } | undefined;
  units: readonly U[];
  bounds: { min: number; max: number };
  onCommit: (value: { value: number; unit: U } | undefined) => void;
}) {
  const [lastUnit, setLastUnit] = useState<U>(value?.unit ?? units[0]);
  const unit = value?.unit ?? lastUnit;
  return (
    <span className="pbstyle-unit-wrap">
      <NumberInput
        a11yLabel={`${a11yLabel} value`}
        value={value?.value}
        step={1}
        min={bounds.min}
        max={bounds.max}
        onCommit={(next) => onCommit(next === undefined ? undefined : { value: next, unit })}
      />
      <UnitPicker
        a11yLabel={`${a11yLabel} unit`}
        units={units}
        value={unit}
        onPick={(next) => {
          setLastUnit(next as U);
          if (value) onCommit({ ...value, unit: next as U });
        }}
      />
    </span>
  );
}

function TrackingEditor({
  a11yLabel,
  value,
  onCommit,
}: {
  a11yLabel: string;
  value: LetterSpacing | undefined;
  onCommit: (value: LetterSpacing | undefined) => void;
}) {
  const [lastUnit, setLastUnit] = useState<TrackingUnit>(value?.unit ?? "em");
  const unit = value?.unit ?? lastUnit;
  return (
    <span className="pbstyle-unit-wrap">
      <NumberInput
        a11yLabel={`${a11yLabel} value`}
        value={value?.value}
        step={0.005}
        min={TRACKING_BOUNDS.min}
        max={TRACKING_BOUNDS.max}
        onCommit={(next) => onCommit(next === undefined ? undefined : { value: next, unit })}
      />
      <UnitPicker
        a11yLabel={`${a11yLabel} unit`}
        units={[...TRACKING_UNITS]}
        value={unit}
        onPick={(next) => {
          setLastUnit(next as TrackingUnit);
          if (value) onCommit({ ...value, unit: next as TrackingUnit });
        }}
      />
    </span>
  );
}

function ColorEditor({
  a11yLabel,
  value,
  onCommit,
}: {
  a11yLabel: string;
  value: ColorChoice | undefined;
  onCommit: (value: ColorChoice | undefined) => void;
}) {
  // Typing buffer: keeps the draft visible while it is still incomplete.
  // `null` means the field mirrors the stored value.
  const [draftHex, setDraftHex] = useState<string | null>(null);
  const raw = value?.source === "raw" ? value.value : "";
  const commit = (hex: string) => {
    setDraftHex(hex);
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) onCommit({ source: "raw", value: hex });
  };
  return (
    <span className="pbstyle-color">
      <label className="pbstyle-color-swatch" aria-label={a11yLabel}>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(raw) ? raw : "#4353e8"}
          onChange={(event) => commit(event.currentTarget.value.toLowerCase())}
        />
        <span className="pbstyle-swatch-preview" aria-hidden="true">
          {raw ? raw : "var"}
        </span>
      </label>
      <input
        type="text"
        className="pbstyle-input pbstyle-color-hex"
        aria-label={`${a11yLabel} hex`}
        placeholder="#4353e8"
        value={draftHex ?? raw}
        onChange={(event) => commit(event.currentTarget.value.trim())}
      />
      <span className="pbstyle-tokens" aria-label="Theme color tokens">
        {COLOR_TOKENS.slice(0, 8).map((entry) => (
          <button
            key={entry.token}
            type="button"
            className="pbstyle-token"
            data-token={entry.token}
            aria-pressed={value?.source === "token" && value.value === entry.token}
            title={`${entry.label} — binds to var(--${entry.token})`}
            onClick={() => {
              setDraftHex(null);
              onCommit({ source: "token", value: entry.token });
            }}
          >
            {entry.label}
          </button>
        ))}
      </span>
    </span>
  );
}

/** Two-stop gradient: from/to colors plus the direction angle (plan 5.3). */
function GradientEditor({
  value,
  onCommit,
}: {
  value: GradientValues | undefined;
  onCommit: (value: GradientValues | undefined) => void;
}) {
  return (
    <span className="pbstyle-gradient">
      <ColorEditor
        a11yLabel="Gradient start color"
        value={value?.from}
        onCommit={(from) => onCommit({ from: from ?? { source: "raw", value: "#000000" }, to: value?.to ?? { source: "raw", value: "#ffffff" }, angle: value?.angle ?? 180 })}
      />
      <span aria-hidden="true" className="pbstyle-gradient-arrow">→</span>
      <ColorEditor
        a11yLabel="Gradient end color"
        value={value?.to}
        onCommit={(to) => onCommit({ from: value?.from ?? { source: "raw", value: "#000000" }, to: to ?? { source: "raw", value: "#ffffff" }, angle: value?.angle ?? 180 })}
      />
      <NumberInput
        a11yLabel="Gradient angle (degrees)"
        value={value?.angle}
        step={15}
        min={GRADIENT_ANGLE_BOUNDS.min}
        max={GRADIENT_ANGLE_BOUNDS.max}
        onCommit={(angle) =>
          onCommit(
            angle === undefined
              ? undefined
              : {
                  from: value?.from ?? { source: "raw", value: "#000000" },
                  to: value?.to ?? { source: "raw", value: "#ffffff" },
                  angle,
                },
          )
        }
      />
    </span>
  );
}

function AlignControl({
  value,
  onSelect,
}: {
  value: TextAlignChoice | undefined;
  onSelect: (value: TextAlignChoice | undefined) => void;
}) {
  return (
    <span className="pbstyle-align" role="group" aria-label="Text alignment">
      {ALIGN_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`pbstyle-align-btn${value === option.key ? " is-active" : ""}`}
          aria-pressed={value === option.key}
          title={option.label}
          onClick={() => onSelect(value === option.key ? undefined : option.key)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" dangerouslySetInnerHTML={{ __html: option.d }} />
          </svg>
        </button>
      ))}
    </span>
  );
}

const ALIGN_OPTIONS: Array<{ key: TextAlignChoice; label: string; d: string }> = [
  { key: "left", label: "Left", d: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>' },
  { key: "center", label: "Center", d: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/>' },
  { key: "right", label: "Right", d: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>' },
  { key: "justify", label: "Justified", d: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="3" y1="12" y2="12"/><line x1="21" x2="3" y1="18" y2="18"/>' },
];

/** Margin and padding: four edges, linked by default, each writable and clearable. */
function EdgeRows({
  title,
  keys,
  get,
  set,
  clear,
  isSet,
}: {
  title: string;
  keys: Array<keyof SpacingValues>;
  get: GroupApi<SpacingValues>["get"];
  set: GroupApi<SpacingValues>["set"];
  clear: GroupApi<SpacingValues>["clear"];
  isSet: GroupApi<SpacingValues>["isSet"];
}) {
  const [linked, setLinked] = useState(true);
  const [lastUnit, setLastUnit] = useState<CssLength["unit"]>("px");
  const edgeLabels = ["Top", "Right", "Bottom", "Left"] as const;

  const writeAll = (next: CssLength | undefined) =>
    set(Object.fromEntries(keys.map((key) => [key, next])) as Partial<SpacingValues>);

  if (linked) {
    const value = get(keys[0]);
    const unit = value?.unit ?? lastUnit;
    return (
      <Row
        label={title}
        isSet={keys.some((key) => isSet(key))}
        onClear={() => keys.forEach((key) => clear(key))}
      >
        <span className="pbstyle-unit-wrap">
          <NumberInput
            a11yLabel={`${title} (all edges)`}
            value={value?.value}
            step={1}
            min={LENGTH_BOUNDS.min}
            max={LENGTH_BOUNDS.max}
            onCommit={(next) =>
              writeAll(next === undefined ? undefined : { value: next, unit })
            }
          />
          <UnitPicker
            a11yLabel={`${title} unit`}
            units={[...LENGTH_UNITS]}
            value={unit}
            onPick={(next) => {
              setLastUnit(next as CssLength["unit"]);
              if (value) writeAll({ ...value, unit: next as CssLength["unit"] });
            }}
          />
          <button type="button" className="pbstyle-link is-active" aria-pressed="true" title="All edges linked — click to edit separately" onClick={() => setLinked(false)}>
            {LINK_SVG}
          </button>
        </span>
      </Row>
    );
  }

  return (
    <div className="pbstyle-edges" role="group" aria-label={title}>
      <span className="pbstyle-row-label pbstyle-edges-title">{title}</span>
      <div className="pbstyle-edges-grid">
        {keys.map((key, index) => (
          <Fragment key={key}>
            <span className="pbstyle-edge-label">{edgeLabels[index]}:</span>
            <LengthEditor
              a11yLabel={`${title} ${edgeLabels[index]}`}
              value={get(key) as CssLength | undefined}
              units={[...LENGTH_UNITS]}
              bounds={LENGTH_BOUNDS}
              onCommit={(next) => set({ [key]: next } as Partial<SpacingValues>)}
            />
            <button
              type="button"
              className="pbstyle-link"
              aria-pressed="false"
              aria-label={`${title} ${edgeLabels[index]} — link`}
              title="All edges linked — click to edit separately"
              onClick={() => setLinked(true)}
            >
              {UNLINK_SVG}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export function deviceForViewport(width: number | "100%" | undefined): DeviceKey {
  if (typeof width !== "number") return "base";
  if (width <= BREAKPOINT_WIDTHS.mobile) return "mobile";
  if (width <= BREAKPOINT_WIDTHS.tablet) return "tablet";
  return "base";
}

/** Style values for a given device, falling back to base when no override exists. */
export function deviceValues<T extends Record<string, unknown>>(
  responsive: Responsive<T> | undefined,
  device: DeviceKey,
): T {
  if (device === "tablet") return { ...(responsive?.base ?? {}), ...(responsive?.tablet ?? {}) } as T;
  if (device === "mobile") return { ...(responsive?.base ?? {}), ...(responsive?.tablet ?? {}), ...(responsive?.mobile ?? {}) } as T;
  return { ...(responsive?.base ?? {}) } as T;
}

function deviceIcon(name: string): React.ReactNode {
  if (name === "Smartphone") return PHONE_SVG;
  if (name === "Tablet") return TABLET_SVG;
  return DESKTOP_SVG;
}

function decode(breakpoint: string): string {
  return breakpoint.replace("max-width: ", "").replace("px", " px");
}

// small inline SVG helpers (lucide strokes), matching app/panel/_components/panel-icons.ts
const DESKTOP_SVG = (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </g>
  </svg>
);
const TABLET_SVG = (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </g>
  </svg>
);
const PHONE_SVG = (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="20" x="5" y="2" rx="2" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </g>
  </svg>
);
const LINK_SVG = (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </g>
  </svg>
);
const UNLINK_SVG = (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="3" x2="21" y1="3" y2="21" />
    </g>
  </svg>
);
