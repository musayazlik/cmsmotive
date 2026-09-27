import Image from "next/image";
import { requirePanelUser } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

export default async function PanelOverviewPage() {
  const session = await requirePanelUser();
  const firstName = session.name.trim().split(/\s+/)[0] || "there";

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> ACCOUNT / OVERVIEW
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Make room for<br />
            <em>better work.</em>
          </h1>
          <p>Welcome back, {firstName}. Your products, resources and project tools will live here.</p>
        </div>
        <span className="workspace-index">01 / 05</span>
      </div>

      <div className="workspace-grid">
        <section className="workspace-feature" aria-labelledby="feature-title">
          <div className="workspace-feature-copy">
            <span className="workspace-tag">
              FEATURED THEME <i> / </i> IN DEVELOPMENT
            </span>
            <h2 id="feature-title">Nordform</h2>
            <p>Considered design foundations for ambitious TYPO3 projects.</p>
            <a href="/theme-nordform">
              Explore the theme <span aria-hidden="true">↗</span>
            </a>
          </div>
          <Image src="/assets/images/hero-nordform-v2.webp" alt="Nordform architecture concept" width={1536} height={1024} />
        </section>
        <section className="workspace-account-card" aria-labelledby="account-title">
          <div className="workspace-card-top">
            <span>ACCOUNT STATUS</span>
            <span>02 / 03</span>
          </div>
          <div className="workspace-account-icon">✓</div>
          <h2 id="account-title">All set to build.</h2>
          <p>Your account is active and you can manage users, themes and extensions from the workspace.</p>
          <div className="workspace-account-email">
            <span>EMAIL ADDRESS</span>
            <strong>{session.email}</strong>
          </div>
        </section>
      </div>

      <section className="workspace-resources" aria-labelledby="resources-title">
        <div className="workspace-section-head">
          <div>
            <span className="workspace-eyebrow">NEXT STEPS / 03</span>
            <h2 id="resources-title">Find your next move.</h2>
          </div>
          <p>Everything you need to learn more about the products and start a conversation.</p>
        </div>
        <div className="workspace-resource-grid">
          <a href="/panel/users">
            <span>01 / MANAGE</span>
            <strong>Users</strong>
            <i aria-hidden="true">↗</i>
          </a>
          <a href="/panel/themes">
            <span>02 / EDIT</span>
            <strong>Themes</strong>
            <i aria-hidden="true">↗</i>
          </a>
          <a href="/contact">
            <span>03 / CONNECT</span>
            <strong>Talk to us</strong>
            <i aria-hidden="true">↗</i>
          </a>
        </div>
      </section>
    </>
  );
}
