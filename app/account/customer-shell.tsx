"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { copy } from "@/lib/legal-copy";
import { localizePath, type Locale } from "@/lib/i18n/config";
import LanguageSwitcher from "@/app/_components/language-switcher";
import { useSignOut } from "@/app/_components/use-sign-out";
import { useWorkspaceNavigation } from "@/app/panel/_components/use-workspace-navigation";
import { AccountIcon } from "./account-ui";
import NotificationBell, { type BellItem } from "./notification-bell";

export default function CustomerShell({
  user,
  locale: l,
  notifications,
  year,
  children,
}: {
  user: { name: string; email: string; image?: string | null };
  locale: Locale;
  notifications: { unread: number; items: BellItem[] };
  /** Rendered on the server so hydration always matches. */
  year: number;
  children: ReactNode;
}) {
  const path = usePathname();
  const { signOut, pending } = useSignOut();
  const {
    collapsed,
    mobile,
    mobileOpen,
    sidebarRef,
    triggerRef,
    toggle,
    closeMobile,
  } = useWorkspaceNavigation();
  const links = [
    {
      href: "/account",
      icon: "dashboard",
      label: copy(l, "Overview", "Übersicht", "Genel bakış"),
    },
    {
      href: "/account/products",
      icon: "products",
      label: copy(l, "My products", "Meine Produkte", "Ürünlerim"),
    },
    {
      href: "/account/downloads",
      icon: "download",
      label: copy(l, "My files", "Meine Dateien", "Dosyalarım"),
    },
    {
      href: "/account/billing",
      icon: "billing",
      label: copy(
        l,
        "Subscriptions & invoices",
        "Abos & Rechnungen",
        "Abonelikler ve faturalar",
      ),
    },
    {
      href: "/account/notifications",
      icon: "bell",
      label: copy(l, "Notifications", "Benachrichtigungen", "Bildirimler"),
    },
    {
      href: "/account/profile",
      icon: "profile",
      label: copy(l, "My account", "Mein Konto", "Hesabım"),
    },
  ] as const;
  const current = links.find((link) => link.href === path);
  const accountLabel = copy(l, "My account", "Mein Konto", "Hesabım");
  const closeLabel = copy(
    l,
    "Close navigation",
    "Navigation schließen",
    "Menüyü kapat",
  );
  const initial = user.name.trim()[0]?.toUpperCase() || "?";

  return (
    <div
      className="workspace customer-workspace"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
    >
      <a className="workspace-skip" href="#workspace-content">
        {copy(l, "Skip to content", "Zum Inhalt springen", "İçeriğe geç")}
      </a>
      {mobileOpen && (
        <button
          className="workspace-scrim"
          type="button"
          tabIndex={-1}
          aria-label={closeLabel}
          onClick={closeMobile}
        />
      )}
      <aside
        className="workspace-sidebar"
        id="workspace-sidebar"
        ref={sidebarRef}
        role={mobile && mobileOpen ? "dialog" : undefined}
        aria-modal={mobile && mobileOpen ? true : undefined}
        aria-label={accountLabel}
        aria-hidden={mobile && !mobileOpen ? true : undefined}
      >
        <div className="workspace-brand-row">
          <a
            className="workspace-logo"
            href={localizePath("/", l)}
            aria-label="CMSMotive"
          >
            <Image
              className="workspace-brand-full"
              src="/assets/images/logo.png"
              alt="CMSMotive"
              width={144}
              height={48}
              priority
            />
            <Image
              className="workspace-brand-mark"
              src="/assets/icons/favicon.png"
              alt=""
              width={32}
              height={32}
            />
          </a>
          <button
            className="workspace-mobile-close"
            type="button"
            data-sidebar-close
            aria-label={closeLabel}
            onClick={closeMobile}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className="customer-sidebar-context">
          <AccountIcon name="shield" />
          <div>
            <strong>
              {copy(
                l,
                "Customer workspace",
                "Kundenbereich",
                "Kullanıcı paneli",
              )}
            </strong>
            <small>CMSMotive</small>
          </div>
        </div>
        <div className="workspace-sidebar-scroll">
          <div className="workspace-sidebar-label">{accountLabel}</div>
          <nav
            className="workspace-nav"
            aria-label={copy(
              l,
              "Account navigation",
              "Kontonavigation",
              "Hesap menüsü",
            )}
          >
            <div className="workspace-nav-items">
              {links.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  className={path === href ? "active" : undefined}
                  aria-current={path === href ? "page" : undefined}
                  aria-label={label}
                  title={collapsed ? label : undefined}
                  href={`${href}?lang=${l}`}
                  onClick={closeMobile}
                >
                  <AccountIcon name={icon} className="workspace-nav-icon" />
                  <span className="workspace-nav-text">{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
        <div className="workspace-sidebar-bottom">
          <Link
            className="workspace-person"
            href={`/account/profile?lang=${l}`}
            title={accountLabel}
            aria-label={`${accountLabel}: ${user.name}`}
            onClick={closeMobile}
          >
            <span className="customer-person-avatar" data-photo={Boolean(user.image)}>
              {user.image ? <img src={user.image} alt="" width={28} height={28} referrerPolicy="no-referrer" /> : initial}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </Link>
          <button
            className="workspace-signout"
            type="button"
            onClick={signOut}
            disabled={pending}
            aria-label={copy(l, "Sign out", "Abmelden", "Çıkış yap")}
            title={copy(l, "Sign out", "Abmelden", "Çıkış yap")}
          >
            <AccountIcon name="signOut" />
          </button>
        </div>
      </aside>
      <main className="workspace-main" inert={mobileOpen}>
        <header className="workspace-topbar">
          <div className="workspace-topbar-location">
            <button
              className="workspace-navigation-toggle"
              type="button"
              ref={triggerRef}
              onClick={toggle}
              aria-controls="workspace-sidebar"
              aria-expanded={mobile ? mobileOpen : !collapsed}
              aria-label={
                mobile
                  ? copy(l, "Open navigation", "Navigation öffnen", "Menüyü aç")
                  : collapsed
                    ? copy(
                        l,
                        "Expand sidebar",
                        "Seitenleiste erweitern",
                        "Menüyü genişlet",
                      )
                    : copy(
                        l,
                        "Collapse sidebar",
                        "Seitenleiste einklappen",
                        "Menüyü daralt",
                      )
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {mobile ? (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                ) : (
                  <>
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <path d="M9 4v16" />
                  </>
                )}
              </svg>
            </button>
            <nav
              className="workspace-topbar-crumb"
              aria-label={copy(
                l,
                "Breadcrumb",
                "Brotkrumennavigation",
                "Gezinti yolu",
              )}
            >
              <Link
                className="workspace-topbar-home"
                href={`/account?lang=${l}`}
              >
                {accountLabel}
              </Link>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
              <span aria-current="page">
                {current?.label ?? copy(l, "Checkout", "Bestellung", "Ödeme")}
              </span>
            </nav>
          </div>
          <div className="workspace-topbar-tools">
            <a
              className="workspace-backlink"
              href={localizePath("/products", l)}
            >
              {copy(
                l,
                "Explore products",
                "Produkte entdecken",
                "Ürünleri keşfet",
              )}
              <AccountIcon name="external" />
            </a>
            <NotificationBell unread={notifications.unread} items={notifications.items} locale={l} />
            <LanguageSwitcher locale={l} path={path} />
          </div>
        </header>
        <div className="workspace-content" id="workspace-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="customer-legal">
          <p>
            © {year}{" "}
            <a className="customer-legal-brand" href={localizePath("/", l)}>
              CMSMotive
            </a>
            {copy(l, ". All rights reserved.", ". Alle Rechte vorbehalten.", ". Tüm hakları saklıdır.")}
          </p>
          <nav aria-label={copy(l, "Legal", "Rechtliches", "Yasal bilgiler")}>
            <a href={localizePath("/imprint", l)}>
              {copy(l, "Imprint", "Impressum", "Yasal bilgiler")}
            </a>
            <a href={localizePath("/privacy", l)}>
              {copy(l, "Privacy", "Datenschutz", "Gizlilik")}
            </a>
            <a href={localizePath("/terms", l)}>
              {copy(l, "Terms", "Bedingungen", "Koşullar")}
            </a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
