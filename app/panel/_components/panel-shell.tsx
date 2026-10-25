"use client";

import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "@/app/panel/_components/panel-navigation";
import { usePathname } from "@/app/panel/_components/panel-navigation";
import { useEffect, useRef, type ReactNode } from "react";
import SignOutButton from "../sign-out-button";
import PanelHeader from "./panel-header";
import type { PanelStoreOption } from "./store-switcher";
import type { Locale } from "@/lib/i18n/config";
import SupportChat from "./support-chat";
import PanelNavGroup from "./panel-nav-group";
import { PANEL_ICONS, type PanelIconName } from "./panel-icons";

type NavItem = {
  href: string;
  label: string;
  icon: PanelIconName;
  children?: { href: string; label: string }[];
};

/** Single source of truth for the panel navigation. */
const PANEL_NAV: NavItem[] = [
  { href: "/panel", icon: "overview", label: "Overview" },
  {
    href: "/panel/products",
    icon: "products",
    label: "Products",
    children: [
      { href: "/panel/products", label: "All products" },
      { href: "/panel/products/types", label: "Product types" },
      { href: "/panel/changelog", label: "Changelog" },
      { href: "/panel/reviews", label: "Reviews" },
    ],
  },
  {
    href: "/panel/sales",
    icon: "billing",
    label: "Sales",
    children: [
      { href: "/panel/sales/orders", label: "Orders" },
      { href: "/panel/sales/subscriptions", label: "Subscriptions" },
      { href: "/panel/sales/customers", label: "Customers" },
      { href: "/panel/sales/invoices", label: "Invoices" },
      // Licences (Creem licence keys) gets its own page later.
    ],
  },
  {
    href: "/panel/blog",
    icon: "blog",
    label: "Content",
    children: [
      { href: "/panel/blog", label: "Posts" },
      { href: "/panel/blog/categories", label: "Categories" },
      { href: "/panel/blog/tags", label: "Tags" },
      { href: "/panel/blog/comments", label: "Comments" },
      { href: "/panel/media", label: "Media" },
    ],
  },
  { href: "/panel/inbox", icon: "inbox", label: "Inbox" },
  { href: "/panel/users", icon: "users", label: "Users" },
  { href: "/panel/settings", icon: "settings", label: "Settings" },
  { href: "/panel/backup", icon: "transfer", label: "Export / Import" },
];

/** A section is active on its own route and on every route nested under it. */
function isActive(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionFor(pathname: string) {
  // A group's children can live under several roots (Products owns the
  // changelog and reviews pages), so the children decide the section too.
  return (
    PANEL_NAV.find((item) => isActive(pathname, item.href) || (item.children?.some((child) => isActive(pathname, child.href)) ?? false)) ?? null
  );
}

export default function PanelShell({
  user,
  stores,
  storeId,
  siteOrigin,
  systemLanguage,
  children,
}: {
  user: { name: string; email: string; role: string };
  stores: PanelStoreOption[];
  storeId: string;
  /** Public site of the store being edited. */
  siteOrigin: string;
  /** Settings → General → System language: the assistant chat's language. */
  systemLanguage: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const section = sectionFor(pathname);
  const crumb = section?.label ?? (pathname === "/panel/account" ? "My account" : "Workspace");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only the navigation scrolls (logo and account stay put). Keep the active
  // entry in view, e.g. after a full reload on /panel/settings on a short screen.
  // scrollIntoView walks the actual scroll containers: the sidebar on desktop,
  // the horizontal navigation strip on small screens.
  useEffect(() => {
    const area = scrollRef.current;
    // A sub-page (Blog › Tags) marks both links active; the child is the one to show.
    const active = area?.querySelector<HTMLElement>('.workspace-subnav-collapse[data-open="true"] a.active')
      ?? area?.querySelector<HTMLElement>("a.active, .workspace-nav-toggle.active");
    if (!active) return;
    let frame = 0;
    let stopped = false;
    const timers: number[] = [];
    const reveal = () => {
      if (!stopped) active.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    reveal();
    frame = requestAnimationFrame(reveal);
    // Fonts and hydrated icons can still move labels after the first paint, so
    // keep the active entry in view while the route settles.
    for (const delay of [200, 600, 1200]) {
      timers.push(window.setTimeout(reveal, delay));
    }
    void document.fonts?.ready.then(() => {
      if (!stopped) frame = requestAnimationFrame(reveal);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link className="workspace-logo" href="/" aria-label="CMSMotive home">
          <Image src="/assets/images/logo.png" alt="CMSMotive" width={144} height={48} priority />
        </Link>
        <div className="workspace-sidebar-scroll" ref={scrollRef}>
          <div className="workspace-sidebar-label">Workspace</div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            {PANEL_NAV.map((item) => {
              if (item.children) {
                return (
                  <PanelNavGroup
                    key={`${item.href}:${pathname}`}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    items={item.children}
                    pathname={pathname}
                  />
                );
              }
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon icon={PANEL_ICONS[item.icon]} className="workspace-nav-icon" aria-hidden="true" />
                  <span className="workspace-nav-text">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-sidebar-bottom-head">
            <span className="workspace-sidebar-label">Account</span>
            <SignOutButton />
          </div>
          <Link className="workspace-person" href="/panel/account" title="My account">
            <span>{(firstName[0] ?? "?").toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </Link>
        </div>
      </aside>

      <main className="workspace-main">
        <PanelHeader crumb={crumb} user={user} stores={stores} storeId={storeId} siteOrigin={siteOrigin} />
        <div className="workspace-content">{children}</div>
      </main>

      <SupportChat firstName={firstName} language={systemLanguage} />
    </div>
  );
}
