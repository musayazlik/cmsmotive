"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SignOutButton from "../sign-out-button";
import PanelHeader from "./panel-header";

type NavItem = {
  href: string;
  index: string;
  label: string;
  children?: { href: string; label: string }[];
};

/** Single source of truth for the panel navigation. */
const PANEL_NAV: NavItem[] = [
  { href: "/panel", index: "01", label: "Overview" },
  { href: "/panel/users", index: "02", label: "Users" },
  { href: "/panel/themes", index: "03", label: "Themes" },
  { href: "/panel/extensions", index: "04", label: "Extensions" },
  {
    href: "/panel/blog",
    index: "05",
    label: "Blog",
    children: [
      { href: "/panel/blog", label: "Posts" },
      { href: "/panel/blog/categories", label: "Categories" },
      { href: "/panel/blog/tags", label: "Tags" },
    ],
  },
  { href: "/docs", index: "06", label: "Documentation" },
];

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
  children,
}: {
  user: { name: string; email: string; role: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const section = sectionFor(pathname);
  const crumb = section ? section.label.toUpperCase() : "WORKSPACE";

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link className="workspace-logo" href="/" aria-label="CMSMotive home">
          <Image src="/assets/images/logo.png" alt="CMSMotive" width={144} height={48} priority />
        </Link>
        <div className="workspace-sidebar-label">YOUR WORKSPACE / 01</div>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          {PANEL_NAV.map((item) => (
            <div key={item.href} className="workspace-nav-group">
              <Link href={item.href} className={isActive(pathname, item.href) ? "active" : undefined}>
                <span>{item.index}</span> {item.label} <b aria-hidden="true">↗</b>
              </Link>
              {item.children ? (
                <div className="workspace-subnav">
                  {item.children.map((child) => (
                    <Link key={child.href} href={child.href} className={pathname === child.href ? "active" : undefined}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <span className="workspace-sidebar-label">ACCOUNT</span>
          <div className="workspace-person">
            <span>{(firstName[0] ?? "?").toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="workspace-main">
        <PanelHeader crumb={crumb} user={user} />
        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}
