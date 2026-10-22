"use client";

import { useId, useState } from "react";
import Link from "./panel-navigation";

type PanelNavGroupProps = {
  href: string;
  index: string;
  label: string;
  items: { href: string; label: string; count?: number }[];
  pathname: string;
};

/** A disclosure button keeps expanding a section separate from following a link. */
export default function PanelNavGroup({ href, index, label, items, pathname }: PanelNavGroupProps) {
  const id = useId();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  // The shell keys this disclosure by route, revealing the active section on navigation.
  const [open, setOpen] = useState(active);
  const pendingCount = items.reduce((total, item) => total + (item.count ?? 0), 0);
  const activeChild = active
    ? items.find((item) => item.href !== href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))?.href ?? href
    : undefined;

  return (
    <div className="workspace-nav-group workspace-nav-group--collapsible">
      <button
        className={`workspace-nav-toggle${active ? " active" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="workspace-nav-index" aria-hidden="true">{index}</span>
        <span className="workspace-nav-text">{label}</span>
        {pendingCount > 0 && <><span className="workspace-nav-count" aria-hidden="true">{pendingCount > 9 ? "9+" : pendingCount}</span><span className="visually-hidden">{pendingCount} awaiting approval</span></>}
        <svg className="workspace-nav-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m7.5 5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={id} className="workspace-subnav-collapse" data-open={open} inert={!open} aria-hidden={!open}>
        <div className="workspace-subnav-clip">
          <div className="workspace-subnav">
            {items.map((item) => (
              <Link key={item.href} href={item.href} className={activeChild === item.href ? "active" : undefined} aria-current={activeChild === item.href ? "page" : undefined}>
                {item.label}
                {!!item.count && <><span className="workspace-nav-count" aria-hidden="true">{item.count > 9 ? "9+" : item.count}</span><span className="visually-hidden">{item.count} awaiting approval</span></>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
