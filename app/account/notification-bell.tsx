"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { copy } from "@/lib/legal-copy";
import type { Locale } from "@/lib/i18n/config";
import { AccountIcon } from "./account-ui";
import { markNotificationsReadAction } from "./notifications/_actions";

export type BellItem = { id: string; title: string; body: string; href: string; time: string; read: boolean };

/** Topbar bell: unread badge, the latest messages, and a way to the full list. */
export default function NotificationBell({ unread, items, locale: l }: { unread: number; items: BellItem[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = copy(l, "Notifications", "Benachrichtigungen", "Bildirimler");
  const markRead = (ids?: string[]) => startTransition(() => void markNotificationsReadAction(ids));

  return (
    <div className="customer-bell" ref={root}>
      <button
        className="customer-bell-button"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `${label} (${unread})` : label}
        onClick={() => setOpen((value) => !value)}
      >
        <AccountIcon name="bell" />
        {unread > 0 && <span className="customer-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="customer-bell-panel" role="region" aria-label={label}>
          <header>
            <strong>{label}</strong>
            <button type="button" disabled={!unread || pending} onClick={() => markRead()}>
              {copy(l, "Mark all as read", "Alle als gelesen markieren", "Tümünü okundu işaretle")}
            </button>
          </header>
          {items.length === 0 ? (
            <p className="customer-bell-empty">{copy(l, "You're all caught up.", "Sie sind auf dem neuesten Stand.", "Her şey güncel.")}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} data-unread={!item.read}>
                  <Link
                    href={`${item.href}?lang=${l}`}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read) markRead([item.id]);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <time>{item.time}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="customer-bell-all" href={`/account/notifications?lang=${l}`} onClick={() => setOpen(false)}>
            {copy(l, "View all notifications", "Alle Benachrichtigungen ansehen", "Tüm bildirimleri gör")}
          </Link>
        </div>
      )}
    </div>
  );
}
