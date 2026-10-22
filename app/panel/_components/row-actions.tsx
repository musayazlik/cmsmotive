"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowAction = {
  label: string;
  /** Runs on select; ignored when href is set. */
  onSelect?: () => void;
  href?: string;
  /** Opens href in a new tab. */
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
};

const GAP = 6;
const EDGE = 8;

/**
 * The "⋯" actions menu at the end of a table row. The menu is portalled to
 * the body with fixed positioning, because the tables sit in horizontally
 * scrolling wrappers that would clip an absolutely positioned dropdown. It
 * opens upwards near the bottom of the viewport and closes on outside
 * clicks, scrolling, resizing and Escape. Arrow keys move between items.
 */
export default function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Place the menu once it has a size: right-aligned to the trigger, flipped above when there is no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const { offsetWidth: width, offsetHeight: height } = menu;
    const below = trigger.bottom + GAP;
    const top = below + height > window.innerHeight - EDGE ? Math.max(EDGE, trigger.top - GAP - height) : below;
    const left = Math.min(Math.max(EDGE, trigger.right - width), window.innerWidth - width - EDGE);
    setPosition({ top, left });
  }, [open]);

  // Focus the first item once the menu is placed; a still-hidden element cannot take focus.
  useEffect(() => {
    if (open && position) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    // Escape works wherever focus is, e.g. still on the trigger after a mouse click.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onViewportChange = () => close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, close]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Tab") {
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }

  const visible = actions.filter(Boolean);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="wbtn wbtn-ghost wbtn-sm wrow-trigger"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 16 4" aria-hidden="true" focusable="false">
          <circle cx="2" cy="2" r="1.6" />
          <circle cx="8" cy="2" r="1.6" />
          <circle cx="14" cy="2" r="1.6" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="wmenu wrow-menu"
              role="menu"
              aria-label={`Actions for ${label}`}
              onKeyDown={onMenuKeyDown}
              // Hidden until measured so it never flashes at the wrong spot.
              style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: "hidden" }}
            >
              {visible.map((action) => {
                const className = `wmenu-item${action.danger ? " wmenu-item-danger" : ""}`;
                const item = action.href && !action.disabled ? (
                  <Link
                    role="menuitem"
                    className={className}
                    href={action.href}
                    {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    onClick={() => close()}
                  >
                    {action.label}
                    {action.external ? <span aria-hidden="true">↗</span> : null}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={className}
                    aria-disabled={action.disabled || undefined}
                    disabled={action.disabled}
                    onClick={() => {
                      close(true);
                      action.onSelect?.();
                    }}
                  >
                    {action.label}
                  </button>
                );
                return (
                  <div key={action.label}>
                    {action.separated ? <div className="wmenu-divider" role="separator" /> : null}
                    {item}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
