"use client";

import Image from "next/image";
import Link from "@/app/panel/_components/panel-navigation";
import { usePathname } from "@/app/panel/_components/panel-navigation";
import { useEffect, useRef, type ReactNode } from "react";
import SignOutButton from "../sign-out-button";
import PanelHeader from "./panel-header";
import SupportChat from "./support-chat";
import PanelNavGroup from "./panel-nav-group";

type NavItem = {
  href: string;
  index: string;
  label: string;
  children?: { href: string; label: string }[];
};

/** Single source of truth for the panel navigation. */
const PANEL_NAV: NavItem[] = [
  { href: "/panel", index: "01", label: "Overview" },
  { href: "/panel/inbox", index: "02", label: "Inbox" },
  { href: "/panel/reviews", index: "03", label: "Reviews" },
  { href: "/panel/users", index: "04", label: "Users" },
  { href: "/panel/themes", index: "05", label: "Themes" },
  { href: "/panel/extensions", index: "06", label: "Extensions" },
  { href: "/panel/changelog", index: "07", label: "Changelog" },
  {
    href: "/panel/blog",
    index: "08",
    label: "Blog",
    children: [
      { href: "/panel/blog", label: "Posts" },
      { href: "/panel/blog/categories", label: "Categories" },
      { href: "/panel/blog/tags", label: "Tags" },
      { href: "/panel/blog/comments", label: "Comments" },
    ],
  },
  { href: "/panel/media", index: "09", label: "Media" },
  { href: "/panel/settings", index: "10", label: "Settings" },
  { href: "/panel/backup", index: "11", label: "Export / Import" },
];

/** Sidebar badges: count, and the screen-reader wording for one / many. */
function navBadge(href: string, counts: { unreadInquiries: number; pendingReviews: number }) {
  if (href === "/panel/inbox") return { count: counts.unreadInquiries, one: "unread contact message", many: "unread contact messages" };
  if (href === "/panel/reviews") return { count: counts.pendingReviews, one: "review awaiting approval", many: "reviews awaiting approval" };
  return null;
}

/** A section is active on its own route and on every route nested under it. */
function isActive(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionFor(pathname: string) {
  return PANEL_NAV.find((item) => isActive(pathname, item.href)) ?? null;
}

export default function PanelShell({
  user,
  unreadInquiries,
  pendingReviews,
  pendingComments,
  children,
}: {
  user: { name: string; email: string; role: string };
  unreadInquiries: number;
  pendingReviews: number;
  pendingComments: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const section = sectionFor(pathname);
  const crumb = section?.label ?? (pathname === "/panel/account" ? "My account" : "Workspace");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only the navigation scrolls (logo and account stay put). Keep the active
  // entry in view, e.g. after a full reload on /panel/settings on a short screen.
  useEffect(() => {
    const area = scrollRef.current;
    // A sub-page (Blog › Tags) marks both links active; the child is the one to show.
    const active = area?.querySelector<HTMLElement>('.workspace-subnav-collapse[data-open="true"] a.active')
      ?? area?.querySelector<HTMLElement>("a.active, .workspace-nav-toggle.active");
    if (!area || !active) return;
    const areaBox = area.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    const margin = 24;
    if (box.top < areaBox.top + margin) area.scrollTop -= areaBox.top + margin - box.top;
    else if (box.bottom > areaBox.bottom - margin) area.scrollTop += box.bottom - (areaBox.bottom - margin);
  }, [pathname]);

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link className="workspace-logo" href="/" aria-label="CMSMotive home">
          <Image src="/assets/images/logo.png" alt="CMSMotive" width={144} height={48} priority />
        </Link>
        <div className="workspace-sidebar-scroll" ref={scrollRef}>
          <div className="workspace-sidebar-label">YOUR WORKSPACE / 01</div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            {PANEL_NAV.map((item) => {
              if (item.children) {
                return <PanelNavGroup key={`${item.href}:${pathname}`} href={item.href} index={item.index} label={item.label} items={item.children.map((child) => ({ ...child, count: child.href === "/panel/blog/comments" ? pendingComments : 0 }))} pathname={pathname} />;
              }
              const badge = navBadge(item.href, { unreadInquiries, pendingReviews });
              return (
                <div key={item.href} className="workspace-nav-group">
                  <Link href={item.href} className={isActive(pathname, item.href) ? "active" : undefined}>
                    <span>{item.index}</span> {item.label}
                    {badge && badge.count > 0 ? (
                      <>
                        <span className="workspace-nav-count" aria-hidden="true">
                          {badge.count > 9 ? "9+" : badge.count}
                        </span>
                        <span className="visually-hidden">
                          {badge.count} {badge.count === 1 ? badge.one : badge.many}
                        </span>
                      </>
                    ) : null}
                    <b aria-hidden="true">↗</b>
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="workspace-sidebar-bottom">
          <span className="workspace-sidebar-label">ACCOUNT</span>
          <Link className="workspace-person" href="/panel/account" title="My account">
            <span>{(firstName[0] ?? "?").toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <main className="workspace-main">
        <PanelHeader crumb={crumb} user={user} />
        <div className="workspace-content">{children}</div>
      </main>

      <SupportChat firstName={firstName} />
    </div>
  );
}
