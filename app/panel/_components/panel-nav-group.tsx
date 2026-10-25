"use client";

import { Icon } from "@iconify/react";
import { useId, useState } from "react";
import Link from "./panel-navigation";
import { PANEL_ICONS, type PanelIconName } from "./panel-icons";

type PanelNavGroupProps = {
  href: string;
  icon: PanelIconName;
  label: string;
  items: { href: string; label: string }[];
  pathname: string;
  compact?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
};

/** A disclosure button keeps expanding a section separate from following a link. */
export default function PanelNavGroup({
  href,
  icon,
  label,
  items,
  pathname,
  compact = false,
  onExpand,
  onNavigate,
}: PanelNavGroupProps) {
  const id = useId();
  const matches = (target: string) =>
    pathname === target || pathname.startsWith(`${target}/`);
  // A group's children can live under several roots (Products owns the
  // changelog and reviews pages), so any child route marks the section active.
  const active = matches(href) || items.some((item) => matches(item.href));
  // The shell keys this disclosure by route, revealing the active section on navigation.
  const [open, setOpen] = useState(active);
  // The deepest matching child owns the solid active state ("/panel/blog" is Posts,
  // not the section button). The section itself keeps a softer highlight.
  const activeChild = active
    ? items
        .filter((item) => matches(item.href))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href
    : undefined;

  return (
    <div className="workspace-nav-group workspace-nav-group--collapsible">
      <button
        className={`workspace-nav-toggle${activeChild ? " section" : active ? " active" : ""}`}
        type="button"
        aria-expanded={open && !compact}
        aria-controls={id}
        aria-label={label}
        title={compact ? label : undefined}
        onClick={() => {
          if (compact) {
            onExpand?.();
            setOpen(true);
          } else setOpen((value) => !value);
        }}
      >
        <Icon
          icon={PANEL_ICONS[icon]}
          className="workspace-nav-icon"
          aria-hidden="true"
        />
        <span className="workspace-nav-text">{label}</span>
        <Icon
          icon={PANEL_ICONS.chevronDown}
          className="workspace-nav-chevron"
          aria-hidden="true"
        />
      </button>
      <div
        id={id}
        className="workspace-subnav-collapse"
        data-open={open && !compact}
        inert={!open || compact}
        aria-hidden={!open || compact}
      >
        <div className="workspace-subnav-clip">
          <div className="workspace-subnav">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={activeChild === item.href ? "active" : undefined}
                aria-current={activeChild === item.href ? "page" : undefined}
              >
                <span className="workspace-subnav-dot" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
