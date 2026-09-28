import type { ReactNode } from "react";
import Script from "next/script";

/**
 * Public-site chrome for the Next.js blog pages, mirroring the markup the
 * static-site pages ship (site.css + site.js do the actual styling and
 * behavior). Links are plain anchors on purpose: every other public page is
 * served as prerendered HTML, so full page loads are the expected motion.
 */

const NAV = [
  { href: "/themes", label: "Themes" },
  { href: "/extensions", label: "Extensions" },
  { href: "/headless", label: "Headless" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="logo logo-header" href="/" aria-label="CMSMotive home">
          <img src="/assets/images/logo.png" alt="CMSMotive" width={144} height={48} />
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {NAV.map((item) => (
            <a key={item.href} className="nav-link" href={item.href} aria-current={current === item.href ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="btn btn-primary" href="/themes">
            <span className="btn-label">Explore themes</span>
            <span className="btn-icon" aria-hidden="true">
              <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
            </span>
          </a>
          <button className="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined}>
            {item.label}
          </a>
        ))}
        <a className="btn btn-primary" href="/themes">
          <span className="btn-label">Explore themes</span>
          <span className="btn-icon" aria-hidden="true">
            <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
          </span>
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="logo logo-footer" href="/" aria-label="CMSMotive home">
              <img src="/assets/images/logo-dark.png" alt="CMSMotive" width={180} height={60} />
            </a>
            <p>Thoughtful TYPO3 products for teams building real websites. Designed to make the next project feel less like starting over.</p>
          </div>
          <div className="footer-col">
            <div className="footer-label">Products</div>
            <a href="/themes">Themes</a>
            <a href="/theme-nordform">Nordform</a>
            <a href="/theme-foundation">Foundation</a>
            <a href="/theme-campus">Campus</a>
            <a href="/extensions">Extensions</a>
            <a href="/headless">Headless</a>
            <a href="/pricing">Licensing</a>
          </div>
          <div className="footer-col">
            <div className="footer-label">Resources</div>
            <a href="/docs">Documentation</a>
            <a href="/blog">Journal</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </div>
          <div className="footer-col">
            <div className="footer-label">Legal</div>
            <a href="/imprint">Imprint</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/cookies">Cookies</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © 2026 CMSMotive. Independent product concept. TYPO3 is a registered trademark of the TYPO3 Association;
            CMSMotive is not affiliated with or endorsed by the TYPO3 Association.
          </p>
          <p>Built for the long run. &nbsp;↗</p>
        </div>
      </div>
    </footer>
  );
}

export function BackToTop() {
  return (
    <button className="back-to-top" data-back-to-top type="button" aria-label="Back to top">
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

/** Full public page frame: skip link, header, content, footer, site script. */
export function SiteFrame({ current, children }: { current?: string; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader current={current} />
      <main id="main">{children}</main>
      <SiteFooter />
      <BackToTop />
      <Script src="/assets/js/site.js" strategy="afterInteractive" />
    </>
  );
}
