import type { ReactNode } from "react";
import Script from "next/script";
import { localizePath, type Locale } from "@/lib/i18n/config";
import LanguageSwitcher from "@/app/_components/language-switcher";
import { getTranslator, type Translate } from "@/lib/i18n/translate";
import { getPublicAccount } from "@/lib/public-session";
import { isAdminRole } from "@/lib/admin-guard";
import {accountMenuHtml,type PublicAccount} from "@/lib/site-account-menu";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getMaintenanceSettings } from "@/lib/settings";
import { currentStoreId } from "@/lib/current-store";
import { getLegalDocumentSettings } from "@/lib/legal-documents";
import { legalFooterLinks } from "@/lib/legal-documents-shared";

/**
 * Public-site chrome for the Next.js pages (journal, theme and extension detail pages), mirroring the markup the
 * static-site pages ship. The language menu uses the shared React component;
 * site.css + site.js handle the remaining public chrome. Links are plain anchors: other public pages are
 * served as prerendered HTML, so full page loads are the expected motion.
 * Copy comes from the shared catalog (lib/i18n/translate.ts), keyed by the
 * English text of the static pages.
 */

/** Manrope and DM Mono, as linked from the static pages' head (build.py FONTS_CSS); site.css no longer imports them. */
const FONTS_CSS = "/assets/css/fonts.css";

const NAV = [
  { href: "/themes", label: "Themes" },
  { href: "/extensions", label: "Extensions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const SOCIAL = [
  {
    href: "https://www.linkedin.com/company/cmsmotive",
    label: "LinkedIn",
    icon: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z",
  },
  {
    href: "https://github.com/cmsmotive",
    label: "GitHub",
    icon: "M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57l-.02-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3",
  },
  {
    href: "https://x.com/cmsmotive",
    label: "X",
    icon: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.59l5.25 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z",
  },
  {
    href: "https://www.youtube.com/@cmsmotive",
    label: "YouTube",
    icon: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z",
  },
];

/** What every chrome part needs: the language, its translator, and the page's unprefixed path. */
type ChromeProps = { locale: Locale; t: Translate; path: string };

/**
 * Utility bar above the sticky header; mirrors TOPBAR in static-site/build.py.
 * Account entry lives in the header's avatar menu, so the bar stays purely informational.
 */
export function TopBar({ locale, t, path }: ChromeProps) {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="topbar-start">
          <a className="topbar-mail" href="mailto:info@cmsmotive.de">
            <span className="topbar-mail-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m4 7.5 8 6 8-6" />
              </svg>
            </span>
            <span className="topbar-mail-address">info@cmsmotive.de</span>
            <span className="topbar-mail-short">{t("Email us")}</span>
          </a>
          <span className="topbar-note">{t("Replies within one business day")}</span>
        </div>
        <div className="topbar-end">
          <ul className="topbar-social" aria-label={t("CMSMotive on social media")}>
            {SOCIAL.map((item) => (
              <li key={item.label}>
                <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <span className="topbar-divider" aria-hidden="true"></span>
          <LanguageSwitcher locale={locale} path={path} routing="path" tone="dark" />
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ locale, t, current, account, adminHref }: Omit<ChromeProps, "path"> & { current?: string;account?:PublicAccount|null;adminHref?:string }) {
  const href = (path: string) => localizePath(path, locale);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="logo logo-header" href={href("/")} aria-label={t("CMSMotive home")}>
          <img src="/assets/images/logo.png" alt="CMSMotive" width={144} height={48} />
        </a>
        <nav className="desktop-nav" aria-label={t("Primary navigation")}>
          {NAV.map((item) => (
            <a key={item.href} className="nav-link" href={href(item.href)} aria-current={current === item.href ? "page" : undefined}>
              {t(item.label)}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {account ? <div dangerouslySetInnerHTML={{__html:accountMenuHtml(account,locale,adminHref)}} /> :
          <a className="btn btn-primary" href={`/auth/sign-in?lang=${locale}`}>
            <span className="btn-label">{t("Sign in")}</span>
          </a>}
          <button className="menu-toggle" type="button" aria-label={t("Open menu")} aria-expanded="false" aria-controls="mobile-nav">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      <nav className="mobile-nav" id="mobile-nav" aria-label={t("Mobile navigation")}>
        {NAV.map((item) => (
          <a key={item.href} href={href(item.href)} aria-current={current === item.href ? "page" : undefined}>
            {t(item.label)}
          </a>
        ))}
        {account ? null : (
          <a className="btn btn-primary" href={`/auth/sign-in?lang=${locale}`}>
            <span className="btn-label">{t("Sign in")}</span>
          </a>
        )}
      </nav>
    </header>
  );
}

export async function SiteFooter({ locale, t }: Omit<ChromeProps, "path">) {
  const legalLinks = legalFooterLinks(await getLegalDocumentSettings(await currentStoreId()), locale);
  const href = (path: string) => localizePath(path, locale);
  const column = (label: string, links: [string, string][]) => (
    <div className="footer-col">
      <div className="footer-label">{t(label)}</div>
      {links.map(([path, text]) => (
        <a key={path} href={href(path)}>
          {t(text)}
        </a>
      ))}
    </div>
  );
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="logo logo-footer" href={href("/")} aria-label={t("CMSMotive home")}>
              <img src="/assets/images/logo-dark.png" alt="CMSMotive" width={180} height={60} />
            </a>
            <p>{t("Thoughtful TYPO3 products for teams building real websites. Designed to make the next project feel less like starting over.")}</p>
          </div>
          {column("Products", [
            ["/themes", "Themes"],
            ["/products/nordform", "Nordform"],
            ["/products/foundation", "Foundation"],
            ["/products/campus", "Campus"],
            ["/extensions", "Extensions"],
            ["/headless", "Headless"],
            ["/pricing", "Licensing"],
          ])}
          {column("Resources", [
            ["/docs", "Documentation"],
            ["/blog", "Journal"],
            ["/about", "About"],
            ["/contact", "Contact"],
          ])}
          <div className="footer-col">
            <div className="footer-label">{t("Legal")}</div>
            {legalLinks.map((link) => <a key={link.href} href={link.href}>{link.title}</a>)}
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            {t(
              "© 2026 CMSMotive. Independent product concept. TYPO3 is a registered trademark of the TYPO3 Association; CMSMotive is not affiliated with or endorsed by the TYPO3 Association.",
            )}
          </p>
          <p>{t("Built for the long run. &nbsp;↗")}</p>
        </div>
      </div>
    </footer>
  );
}

export function BackToTop({ t }: { t: Translate }) {
  return (
    <button className="back-to-top" data-back-to-top type="button" aria-label={t("Back to top")}>
      <svg className="back-to-top-shape" viewBox="0 0 64 58" aria-hidden="true">
        <path
          className="back-to-top-bg"
          d="M11.9 41.5L25.9 16.8Q32 6 38.1 16.8L52.1 41.5Q58 52 46 52L18 52Q6 52 11.9 41.5Z"
        />
        <g className="back-to-top-arrow" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 42V27" />
          <path d="m26 33 6-6 6 6" />
        </g>
      </svg>
    </button>
  );
}

/**
 * Full public page frame: skip link, top bar, header, content, footer, site script.
 * `path` is the page's unprefixed path, used for the language menu links.
 */
export async function SiteFrame({
  locale,
  path,
  current,
  children,
}: {
  locale: Locale;
  path: string;
  current?: string;
  children: ReactNode;
}) {
  const t = getTranslator(locale);
  // Signed-in visitors get the admin-panel shortcut in the top bar.
  const account = await getPublicAccount();
  const showAdmin = isAdminRole(account?.role);
  const adminHref = showAdmin ? (await getAdminAccessSettings()).panelPath : undefined;
  const showMaintenance = showAdmin && (await getMaintenanceSettings(await currentStoreId())).enabled;
  return (
    <>
      {/* React hoists these into <head>. */}
      <link rel="stylesheet" href={FONTS_CSS} precedence="default" />
      {account&&<link rel="stylesheet" href="/assets/css/site-account.css" precedence="default" />}
      <a className="skip-link" href="#main">
        {t("Skip to content")}
      </a>
      {showMaintenance ? (
        <div className="maintenance-notice" role="status">
          <p className="container">{t("This site is currently in maintenance mode.")}</p>
        </div>
      ) : null}
      <TopBar locale={locale} t={t} path={path} />
      <SiteHeader locale={locale} t={t} current={current} account={account} adminHref={adminHref} />
      <main id="main">{children}</main>
      <SiteFooter locale={locale} t={t} />
      <BackToTop t={t} />
      <Script src="/assets/js/site.js" strategy="afterInteractive" />
    </>
  );
}
