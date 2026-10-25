"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { usePathname } from "@/app/panel/_components/panel-navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useSignOut } from "@/app/_components/use-sign-out";
import StoreSwitcher, { type PanelStoreOption } from "./store-switcher";

type Notification = {
  id: string;
  tone: "info" | "warn";
  title: string;
  detail: string;
  href: string;
  count: number;
  /** Counts toward the bell badge; informational items stay menu-only. */
  actionable: boolean;
};

type OpenMenu = "notifications" | "account" | null;

/** Closes the open dropdown on an outside click or Escape. */
function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        ref.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus();
        onDismiss();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  return ref;
}

export default function PanelHeader({
  crumb,
  user,
  stores,
  storeId,
  siteOrigin,
}: {
  crumb: string;
  user: { name: string; email: string; role: string };
  stores: PanelStoreOption[];
  storeId: string;
  siteOrigin: string;
}) {
  const [open, setOpen] = useState<OpenMenu>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const accountMenuId = useId();
  const notificationsId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut, pending: signingOut } = useSignOut();

  const close = useCallback(() => setOpen(null), []);
  const shellRef = useDismiss(close);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const anchor = menu?.parentElement;
    if (!menu || !anchor) return;

    const fitMenu = () => {
      const top = anchor.getBoundingClientRect().top + menu.offsetTop;
      menu.style.maxHeight = `${Math.max(0, window.innerHeight - top - 12)}px`;
    };
    fitMenu();
    if (open === "account") {
      menu.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
    }
    window.addEventListener("resize", fitMenu);
    window.addEventListener("scroll", fitMenu, { passive: true });
    return () => {
      window.removeEventListener("resize", fitMenu);
      window.removeEventListener("scroll", fitMenu);
    };
  }, [open]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Notifications could not be loaded.");
        return;
      }
      setError("");
      setItems(payload.notifications);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The badge stays live: fetched on mount, refreshed after every in-panel
  // navigation and menu open, plus a slow poll while the tab is visible.
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    if (open === "notifications") load();
  }, [open, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Informational items (drafts, roadmap) do not ring the bell.
  const badge = items?.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <header className="workspace-topbar" ref={shellRef}>
      <nav className="workspace-topbar-crumb" aria-label="Breadcrumb">
        <Link className="workspace-topbar-home" href="/panel">CMSMotive</Link>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="m6 4 4 4-4 4" />
        </svg>
        <span aria-current="page">{crumb}</span>
      </nav>

      <div className="workspace-topbar-tools">
        <StoreSwitcher stores={stores} current={storeId} />
        <a className="workspace-backlink" href={siteOrigin}>
          Back to site <span aria-hidden="true">↗</span>
        </a>

        <div
          className="wmenu-anchor"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
          }}
        >
          <button
            className="wtopbar-icon"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open === "notifications"}
            aria-controls={open === "notifications" ? notificationsId : undefined}
            aria-label={items === null ? "Notifications" : `Notifications, ${badge} item${badge === 1 ? "" : "s"}`}
            onClick={() => setOpen(open === "notifications" ? null : "notifications")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
              <path d="M10.5 20a2 2 0 0 0 3 0" />
            </svg>
            {items !== null && badge > 0 ? <span className="wtopbar-badge">{badge > 9 ? "9+" : badge}</span> : null}
          </button>

          {open === "notifications" ? (
            <div className="wmenu wmenu-wide" id={notificationsId} ref={menuRef} role="dialog" aria-label="Notifications">
              <div className="wmenu-head">
                <span>Notifications</span>
                {items !== null && badge > 0 ? <span className="wmenu-count">{badge}</span> : null}
              </div>
              {items === null && loading ? (
                <p className="wmenu-empty">Loading…</p>
              ) : items === null && error ? (
                <p className="wmenu-empty wmenu-error">{error}</p>
              ) : items === null ? null : items.length === 0 ? (
                <p className="wmenu-empty">Nothing needs your attention.</p>
              ) : (
                <ul className="wmenu-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link className="wmenu-notif" href={item.href} onClick={close}>
                        <span className={`wmenu-dot wmenu-dot-${item.tone}`} aria-hidden="true" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div
          className="wmenu-anchor"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
          }}
        >
          <button
            className="waccount"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open === "account"}
            aria-controls={open === "account" ? accountMenuId : undefined}
            aria-label={`Account menu for ${user.name}`}
            onClick={() => setOpen(open === "account" ? null : "account")}
          >
            <span className="waccount-avatar" aria-hidden="true">
              {(firstName[0] ?? "?").toUpperCase()}
            </span>
            <span className="waccount-copy">
              <span className="waccount-name">{firstName}</span>
              <span className="waccount-role">{roleLabel}</span>
            </span>
            <svg className="waccount-chevron" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
              <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open === "account" ? (
            <div className="wmenu wmenu-account" id={accountMenuId} ref={menuRef} role="dialog" aria-label="Account">
              <div className="wmenu-identity">
                <span className="waccount-avatar" aria-hidden="true">
                  {(firstName[0] ?? "?").toUpperCase()}
                </span>
                <div className="wmenu-identity-copy">
                  <strong>{user.name}</strong>
                  <small title={user.email}>{user.email}</small>
                  <span className="wmenu-role">{roleLabel}</span>
                </div>
              </div>
              <div className="wmenu-divider" />
              <nav className="wmenu-links" aria-label="Account navigation">
                <Link className="wmenu-item" href="/panel" aria-current={pathname === "/panel" ? "page" : undefined} onClick={close}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                  Overview
                </Link>
                <Link
                  className="wmenu-item"
                  href="/panel/account"
                  aria-current={pathname === "/panel/account" ? "page" : undefined}
                  onClick={close}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                  </svg>
                  My account
                </Link>
                <a className="wmenu-item" href={siteOrigin} onClick={close}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M14 3h7v7m0-7L10 14" />
                    <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
                  </svg>
                  View site
                </a>
              </nav>
              <div className="wmenu-divider" />
              <button className="wmenu-item wmenu-item-danger" type="button" onClick={signOut} disabled={signingOut} aria-busy={signingOut}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4m7-16 5 5-5 5m-9-5h14" />
                </svg>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
