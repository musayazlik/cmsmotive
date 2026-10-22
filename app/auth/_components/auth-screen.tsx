import Image from "next/image";
import AuthForm, { type AuthQuery } from "./auth-form";
import type { AuthContent, AuthPageName } from "./auth-content";

const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap";

type AuthScreenProps = {
  page: AuthPageName;
  content: AuthContent;
  /** `/auth`, or the private admin entry path the proxy rewrites from. */
  authRoot: string;
  /** Where a signed-in session lands (sign-in callbackURL). */
  authTarget: string;
  showSwitch: boolean;
  query: AuthQuery;
};

/** Shared, full-viewport shell for every account flow. */
export default function AuthScreen({ page, content, authRoot, authTarget, showSwitch, query }: AuthScreenProps) {
  return (
    <div className="auth-refined" data-auth-page={page}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS_CSS} precedence="default" />
      <a className="auth-skip-link" href="#auth-title">Skip to content</a>
      <main className="auth-main">
        <aside className="auth-story" aria-label="About CMSMotive">
          <a className="auth-logo" href="/" aria-label="CMSMotive home">
            <Image src="/assets/images/logo.png" alt="CMSMotive" width={174} height={58} />
          </a>
          <div className="auth-story-content">
            <h2 className="auth-story-title">{content.storyTitle}</h2>
            <p className="auth-story-description">{content.storyDescription}</p>
            <ProductPreview />
          </div>
          <div className="auth-story-footer">
            <span className="auth-story-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.5" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.5" /></svg>
            </span>
            <span>Thoughtful themes. Powerful extensions.<br /><strong>Made for TYPO3.</strong></span>
          </div>
        </aside>
        <section className="auth-panel" aria-labelledby="auth-title">
          <header className="auth-panel-header">
            <a className="auth-logo auth-mobile-logo" href="/" aria-label="CMSMotive home">
              <Image src="/assets/images/logo.png" alt="CMSMotive" width={150} height={50} />
            </a>
            <a className="auth-back" href="/">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m8 5-5 5 5 5M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back to site
            </a>
          </header>
          <div className="auth-panel-inner">
            <div className="auth-panel-heading">
              <div className="auth-page-icon" aria-hidden="true"><PageIcon page={page} /></div>
              <h1 id="auth-title" tabIndex={-1}>{content.title}</h1>
              <p>{content.description}</p>
            </div>
            <AuthForm page={page} content={content} authRoot={authRoot} authTarget={authTarget} query={query} />
            {showSwitch && (
              <p className="auth-switch">
                {content.switchText}{" "}
                <a href={`${authRoot}/${content.switchPage}`}>{content.switchLabel}</a>
              </p>
            )}
          </div>
          <footer className="auth-footer">
            <span>© {new Date().getFullYear()} CMSMotive</span>
            <nav aria-label="Legal and support">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Help</a>
            </nav>
          </footer>
        </section>
      </main>
    </div>
  );
}

function ProductPreview() {
  return (
    <figure className="auth-product">
      <div className="auth-product-window">
        <div className="auth-product-toolbar" aria-hidden="true">
          <span className="auth-window-dots"><i /><i /><i /></span>
          <span className="auth-window-address">nordform.cmsmotive.com</span>
          <svg viewBox="0 0 16 16" fill="none"><path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </div>
        <div className="auth-product-nav" aria-hidden="true">
          <span>nordform<span className="auth-product-dot">.</span></span>
          <span>Architecture &amp; spaces</span>
          <svg viewBox="0 0 18 18" fill="none"><path d="M3 6h12M3 12h12" stroke="currentColor" strokeWidth="1.3" /></svg>
        </div>
        <div className="auth-product-image">
          <Image src="/assets/images/hero-nordform-v2.webp" alt="Nordform theme preview featuring contemporary architecture" fill sizes="(max-width: 900px) 1px, (max-width: 1400px) 40vw, 560px" />
          <span aria-hidden="true">Spaces for<br />what’s next.</span>
        </div>
        <div className="auth-product-caption" aria-hidden="true">
          <span>Considered design. Lasting impressions.</span>
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      <figcaption className="auth-product-tag">
        <span className="auth-product-tag-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M14 17h6m-3-3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
        <span><strong>Nordform</strong><span>A foundation for your next TYPO3 site</span></span>
        <span className="auth-product-tag-type">Theme</span>
      </figcaption>
    </figure>
  );
}

function PageIcon({ page }: { page: AuthPageName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {page === "sign-in" ? <path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M4 12h11m-4-4 4 4-4 4" />
        : page === "sign-up" ? <><circle cx="10" cy="8" r="4" /><path d="M3 21v-2a7 7 0 0 1 12-5m4-3v8m-4-4h8" /></>
          : page === "verify-email" ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>
            : <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
    </svg>
  );
}
