"use client";

import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "@/app/panel/_components/panel-navigation";
import { usePathname } from "@/app/panel/_components/panel-navigation";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import SignOutButton from "../sign-out-button";
import PanelHeader from "./panel-header";
import StoreSwitcher, { type PanelStoreOption } from "./store-switcher";
import { useWorkspaceNavigation } from "./use-workspace-navigation";
import type { Locale } from "@/lib/i18n/config";
import SupportChat from "./support-chat";
import PanelNavGroup from "./panel-nav-group";
import { PANEL_ICONS, type PanelIconName } from "./panel-icons";
import { SETTINGS_TABS } from "@/app/panel/settings/_tabs";

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
      { href: "/panel/pages", label: "Pages" },
      { href: "/panel/blog", label: "Posts" },
      { href: "/panel/blog/categories", label: "Categories" },
      { href: "/panel/blog/tags", label: "Tags" },
      { href: "/panel/blog/comments", label: "Comments" },
      { href: "/panel/media", label: "Media" },
    ],
  },
  { href: "/panel/inbox", icon: "inbox", label: "Inbox" },
  { href: "/panel/support", icon: "reviews", label: "Support" },
  { href: "/panel/users", icon: "users", label: "Users" },
  {
    href: "/panel/settings",
    icon: "settings",
    label: "Settings",
    children: SETTINGS_TABS.map((tab) => ({ href: `/panel/settings/${tab.id}`, label: tab.label })),
  },
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
    PANEL_NAV.find(
      (item) =>
        isActive(pathname, item.href) ||
        (item.children?.some((child) => isActive(pathname, child.href)) ??
          false),
    ) ?? null
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
  // Bare mode (plan 5.6): the fullscreen editor page fills the window, the
  // shell stays behind — but the route remains under /panel and its guard.
  const bare = /\/pages\/[^/]+\/edit$/.test(pathname);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const section = sectionFor(pathname);
  const crumb =
    section?.label ??
    (pathname === "/panel/account" ? "My account" : "Workspace");
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    collapsed,
    mobile,
    mobileOpen,
    sidebarRef,
    triggerRef,
    toggle,
    expand,
    closeMobile,
  } = useWorkspaceNavigation();
  const currentStore = stores.find((store) => store.id === storeId);
  const leaf = section?.children
    ?.filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const breadcrumbs = [
    { label: section?.label ?? crumb, href: leaf ? section?.href : undefined },
    ...(leaf ? [{ label: leaf.label, href: undefined }] : []),
  ];

  // Only the navigation scrolls (logo and account stay put). Keep the active
  // entry in view, e.g. after a full reload on /panel/settings on a short screen.
  // scrollIntoView walks the actual scroll containers: the sidebar on desktop,
  // the horizontal navigation strip on small screens.
  useEffect(() => {
    const area = scrollRef.current;
    // A sub-page (Blog › Tags) marks both links active; the child is the one to show.
    const active =
      area?.querySelector<HTMLElement>(
        '.workspace-subnav-collapse[data-open="true"] a.active',
      ) ??
      area?.querySelector<HTMLElement>(
        "a.active, .workspace-nav-toggle.section, .workspace-nav-toggle.active",
      );
    if (!active || !area) return;
    const frame = requestAnimationFrame(() => {
      const box = active.getBoundingClientRect(),
        bounds = area.getBoundingClientRect();
      if (box.top < bounds.top + 12)
        area.scrollTop -= bounds.top + 12 - box.top;
      else if (box.bottom > bounds.bottom - 12)
        area.scrollTop += box.bottom - bounds.bottom + 12;
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  if (bare) return <>{children}</>;

  return (
    <div
      className="workspace admin-workspace"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
    >
      <a className="workspace-skip" href="#workspace-content">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="workspace-scrim"
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <aside
        className="workspace-sidebar"
        id="workspace-sidebar"
        ref={sidebarRef}
        role={mobile && mobileOpen ? "dialog" : undefined}
        aria-modal={mobile && mobileOpen ? true : undefined}
        aria-label="Workspace sidebar"
        aria-hidden={mobile && !mobileOpen ? true : undefined}
      >
        <div className="workspace-brand-row">
          <Link
            className="workspace-logo"
            href="/panel"
            aria-label="CMSMotive overview"
            title="CMSMotive overview"
            onClick={closeMobile}
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
              alt="CMSMotive"
              width={32}
              height={32}
            />
          </Link>
          <button
            className="workspace-mobile-close"
            type="button"
            data-sidebar-close
            aria-label="Close navigation"
            onClick={closeMobile}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className="workspace-store-context">
          {collapsed ? (
            <button
              type="button"
              className="workspace-store-compact"
              aria-label={`Store: ${currentStore?.name ?? "Current store"}. Expand sidebar`}
              title={currentStore?.name ?? "Current store"}
              onClick={expand}
            >
              <Icon icon={PANEL_ICONS.billing} aria-hidden="true" />
            </button>
          ) : (
            <>
              <span className="workspace-store-caption">Active store</span>
              {stores.length > 1 ? (
                <StoreSwitcher stores={stores} current={storeId} />
              ) : (
                <strong className="workspace-store-name">
                  {currentStore?.name ?? "CMSMotive"}
                </strong>
              )}
            </>
          )}
        </div>
        <div className="workspace-sidebar-scroll" ref={scrollRef}>
          <div className="workspace-sidebar-label">Workspace</div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            <div className="workspace-nav-items">
              {PANEL_NAV.map((item) => {
                if (item.href === "/panel/backup" && user.role !== "superadmin") return null;
                const management = item.href === "/panel/settings";
                if (item.children) {
                  return (
                    <PanelNavGroup
                      key={`${item.href}:${pathname}`}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      items={item.children.filter((child) => child.href !== "/panel/settings/security" || user.role === "superadmin")}
                      pathname={pathname}
                      compact={collapsed}
                      onExpand={expand}
                      onNavigate={closeMobile}
                    />
                  );
                }
                const active = isActive(pathname, item.href);
                return (
                  <Fragment key={item.href}>
                    {management && (
                      <div className="workspace-sidebar-label workspace-management-label">
                        Management
                      </div>
                    )}
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      className={active ? "active" : undefined}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        icon={PANEL_ICONS[item.icon]}
                        className="workspace-nav-icon"
                        aria-hidden="true"
                      />
                      <span className="workspace-nav-text">{item.label}</span>
                    </Link>
                  </Fragment>
                );
              })}
            </div>
          </nav>
        </div>
        <div className="workspace-sidebar-bottom">
          <Link
            className="workspace-person"
            href="/panel/account"
            title="My account"
            aria-label={`My account: ${user.name}`}
            onClick={closeMobile}
          >
            <span>{(firstName[0] ?? "?").toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "superadmin"
                  ? "Super administrator"
                  : "Administrator"}
              </small>
            </div>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <main className="workspace-main" inert={mobileOpen}>
        <PanelHeader
          storeId={storeId}
          crumb={crumb}
          breadcrumbs={breadcrumbs}
          user={user}
          siteOrigin={siteOrigin}
          onToggleSidebar={toggle}
          sidebarTriggerRef={triggerRef}
          sidebarExpanded={mobile ? mobileOpen : !collapsed}
          mobileNavigation={mobile}
        />
        <div className="workspace-content" id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </main>

      <SupportChat key={`${storeId}:${systemLanguage}`} firstName={firstName} language={systemLanguage} />
    </div>
  );
}
