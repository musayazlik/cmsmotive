"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { copy, trademarkNote } from "@/lib/legal-copy";
import { localizePath, type Locale } from "@/lib/i18n/config";
import { useSignOut } from "@/app/_components/use-sign-out";
export default function CustomerShell({
  user,
  locale: l,
  children,
}: {
  user: { name: string; email: string };
  locale: Locale;
  children: ReactNode;
}) {
  const path = usePathname();
  const { signOut, pending } = useSignOut();
  const links = [
    ["/account", copy(l, "My products", "Meine Produkte", "Ürünlerim")],
    [
      "/account/billing",
      copy(
        l,
        "Subscriptions & invoices",
        "Abos & Rechnungen",
        "Abonelikler ve faturalar",
      ),
    ],
    ["/account/profile", copy(l, "My account", "Mein Konto", "Hesabım")],
  ];
  return (
    <div className="workspace customer-workspace">
      <aside className="workspace-sidebar">
        <a className="workspace-logo" href={localizePath("/", l)}>
          <Image
            src="/assets/images/logo.png"
            alt="CMSMotive"
            width={144}
            height={48}
          />
        </a>
        <div className="workspace-sidebar-scroll">
          <div className="workspace-sidebar-label">CMSMOTIVE / ACCOUNT</div>
          <nav
            className="workspace-nav"
            aria-label={copy(
              l,
              "Account navigation",
              "Kontonavigation",
              "Hesap menüsü",
            )}
          >
            {links.map(([href, label], i) => (
              <div className="workspace-nav-group" key={href}>
                <a
                  className={path === href ? "active" : undefined}
                  aria-current={path === href ? "page" : undefined}
                  href={`${href}?lang=${l}`}
                >
                  <span>0{i + 1}</span>
                  {label}
                  <b aria-hidden="true">↗</b>
                </a>
              </div>
            ))}
          </nav>
        </div>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-person">
            <span>{user.name[0]?.toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button
            className="wbtn wbtn-ghost"
            onClick={signOut}
            disabled={pending}
          >
            {copy(l, "Sign out", "Abmelden", "Çıkış yap")}
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header">
          <span>CMSMotive</span>
          <nav aria-label="Language">
            {(["de", "en", "tr"] as const).map((lang) => (
              <a
                style={{ padding: 12 }}
                key={lang}
                href={`${path}?lang=${lang}`}
                aria-current={lang === l ? "page" : undefined}
              >
                {lang.toUpperCase()}
              </a>
            ))}
          </nav>
        </header>
        <div className="workspace-content">{children}</div>
        <footer className="customer-legal">
          <p>{trademarkNote(l)}</p>
          <a href={localizePath("/imprint", l)}>
            {copy(l, "Imprint", "Impressum", "Yasal bilgiler")}
          </a>{" "}
          ·{" "}
          <a href={localizePath("/privacy", l)}>
            {copy(l, "Privacy", "Datenschutz", "Gizlilik")}
          </a>{" "}
          ·{" "}
          <a href={localizePath("/terms", l)}>
            {copy(l, "Terms", "Bedingungen", "Koşullar")}
          </a>
        </footer>
      </main>
    </div>
  );
}
