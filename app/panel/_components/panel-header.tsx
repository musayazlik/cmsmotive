"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
      if (event.key === "Escape") onDismiss();
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
}: {
  crumb: string;
  user: { name: string; email: string; role: string };
}) {
  const [open, setOpen] = useState<OpenMenu>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pathname = usePathname();

  const close = useCallback(() => setOpen(null), []);
  const shellRef = useDismiss(close);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

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

  async function signOut() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.location.assign("/");
  }

  // Informational items (drafts, roadmap) do not ring the bell.
  const badge = items?.filter((item) => item.actionable).reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <header className="workspace-topbar" ref={shellRef}>
      <span className="workspace-topbar-crumb">
        CMSMOTIVE <i>/</i> {crumb}
      </span>

      <div className="workspace-topbar-tools">
        <Link className="workspace-backlink" href="/">
          Back to site <span aria-hidden="true">↗</span>
        </Link>

        <div className="wmenu-anchor">
          <button
            className="wtopbar-icon"
            type="button"
            aria-haspopup="true"
            aria-expanded={open === "notifications"}
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
            <div className="wmenu wmenu-wide" role="dialog" aria-label="Notifications">
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

        <div className="wmenu-anchor">
          <button
            className="waccount"
            type="button"
            aria-haspopup="true"
            aria-expanded={open === "account"}
            onClick={() => setOpen(open === "account" ? null : "account")}
          >
            <span className="waccount-avatar" aria-hidden="true">
              {(firstName[0] ?? "?").toUpperCase()}
            </span>
            <span className="waccount-name">{firstName}</span>
            <svg className="waccount-chevron" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
              <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open === "account" ? (
            <div className="wmenu" role="dialog" aria-label="Account">
              <div className="wmenu-identity">
                <span className="waccount-avatar" aria-hidden="true">
                  {(firstName[0] ?? "?").toUpperCase()}
                </span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </span>
              </div>
              <span className="wbadge wbadge-admin">{user.role}</span>
              <div className="wmenu-divider" />
              <Link className="wmenu-item" href="/panel" aria-current={pathname === "/panel" ? "page" : undefined} onClick={close}>
                Overview
              </Link>
              <Link
                className="wmenu-item"
                href="/panel/account"
                aria-current={pathname === "/panel/account" ? "page" : undefined}
                onClick={close}
              >
                My account
              </Link>
              <Link className="wmenu-item" href="/" onClick={close}>
                View site
              </Link>
              <div className="wmenu-divider" />
              <button className="wmenu-item wmenu-item-danger" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
