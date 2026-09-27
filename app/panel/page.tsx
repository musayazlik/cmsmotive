import Image from "next/image";
import { requirePanelUser } from "@/lib/panel-auth";
import {
  getDailyReads,
  getMailStatus,
  getStorageStatus,
  getSystemStatus,
  type DailyReads,
  type MailStatus,
  type StorageStatus,
  type SystemStatus,
} from "@/lib/status";
import { formatBytes } from "./media/_lib";

export const dynamic = "force-dynamic";

function Meter({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="wmeter" role="img" aria-label={`${Math.round(clamped)}% used`}>
      <span style={{ width: `${clamped}%` }} data-high={clamped >= 90 ? "" : undefined} />
    </div>
  );
}

function StatusRow({ label, value, sub, meter }: { label: string; value: string; sub?: string; meter?: number }) {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <div className="status-value">
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}
        {meter !== undefined ? <Meter percent={meter} /> : null}
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: "ok" | "warn" | "off" }) {
  const map = {
    ok: { cls: "wbadge wbadge-verified", label: "Connected" },
    warn: { cls: "wbadge wbadge-pending", label: "Unreachable" },
    off: { cls: "wbadge wbadge-user", label: "Not configured" },
  } as const;
  return <span className={map[state].cls}>{map[state].label}</span>;
}

function SystemCard({ system }: { system: SystemStatus }) {
  return (
    <article className="status-card" aria-labelledby="status-system">
      <header className="status-head">
        <span className="status-title" id="status-system">
          SYSTEM
        </span>
        <span className="status-note">{system.cores} cores</span>
      </header>
      <StatusRow label="CPU load" value={`${system.cpuPercent}%`} sub={`1 min avg`} meter={system.cpuPercent} />
      <StatusRow
        label="Memory"
        value={formatBytes(system.ramUsed)}
        sub={`of ${formatBytes(system.ramTotal)}`}
        meter={(system.ramUsed / system.ramTotal) * 100}
      />
      <StatusRow
        label="Disk"
        value={formatBytes(system.diskUsed)}
        sub={`of ${formatBytes(system.diskTotal)}`}
        meter={system.diskTotal ? (system.diskUsed / system.diskTotal) * 100 : 0}
      />
    </article>
  );
}

function MailCard({ mail }: { mail: MailStatus }) {
  const state = !mail.plunkConfigured ? "off" : mail.plunkContacts === null ? "warn" : "ok";
  return (
    <article className="status-card" aria-labelledby="status-mail">
      <header className="status-head">
        <span className="status-title" id="status-mail">
          MAIL / PLUNK
        </span>
        <StatusBadge state={state} />
      </header>
      <StatusRow
        label="Inquiries"
        value={String(mail.inquiriesTotal)}
        sub={`${mail.inquiriesUnread} unread`}
      />
      <StatusRow label="Deliveries" value={`${mail.emailsSent} sent`} sub={`${mail.emailsFailed} pending`} />
      <StatusRow label="Newsletter" value={`${mail.subscribers} subscribers`} />
      <StatusRow label="Plunk contacts" value={mail.plunkContacts === null ? "—" : String(mail.plunkContacts)} />
    </article>
  );
}

function StorageCard({ storage }: { storage: StorageStatus | null }) {
  return (
    <article className="status-card" aria-labelledby="status-storage">
      <header className="status-head">
        <span className="status-title" id="status-storage">
          STORAGE / UPLOADTHING
        </span>
        <a className="status-link" href="/panel/media">
          Media ↗
        </a>
      </header>
      {storage ? (
        <>
          <StatusRow label="Files" value={String(storage.filesUploaded)} />
          <StatusRow
            label="Used"
            value={formatBytes(storage.totalBytes)}
            sub={storage.limitBytes > 0 ? `of ${formatBytes(storage.limitBytes)} plan` : "plan limit unknown"}
            meter={storage.limitBytes > 0 ? (storage.totalBytes / storage.limitBytes) * 100 : undefined}
          />
        </>
      ) : (
        <StatusRow label="UploadThing" value="—" sub="Stats are unavailable right now." />
      )}
    </article>
  );
}

function DailyReadsTable({ reads }: { reads: DailyReads }) {
  const formatDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="wtable-card">
      <div className="wtable-toolbar">
        <div>
          <span className="status-title">CONTENT READS / DAILY</span>
          <p className="status-caption">Page views on the public site, newest first.</p>
        </div>
      </div>
      <div className="wtable-scroll">
        <table className="wtable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reads</th>
              <th>Top content</th>
            </tr>
          </thead>
          <tbody>
            {reads.days.map((day) => (
              <tr key={day.date}>
                <td className="wtable-date">{formatDay(day.date)}</td>
                <td>
                  <strong>{day.views}</strong>
                </td>
                <td>
                  {day.topSlug ? (
                    <span className="wtable-user">
                      <i className="wdot" aria-hidden="true" />
                      <span className="status-slug" title={day.topSlug}>
                        {day.topSlug}
                      </span>
                      <small>×{day.topViews}</small>
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="wtable-foot">
        <p className="wtable-count">Last {reads.days.length} days</p>
        <p className="wtable-count">{reads.totalAllTime} all-time reads</p>
      </div>
    </div>
  );
}

export default async function PanelOverviewPage() {
  const session = await requirePanelUser();
  const firstName = session.name.trim().split(/\s+/)[0] || "there";
  const [system, mail, storage, reads] = await Promise.all([
    getSystemStatus(),
    getMailStatus(),
    getStorageStatus(),
    getDailyReads(),
  ]);

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
          <p>Welcome back, {firstName}. Here is how the workspace and its services are doing today.</p>
        </div>
        <span className="workspace-index">01 / 05</span>
      </div>

      <div className="status-grid" aria-label="Workspace status">
        <SystemCard system={system} />
        <MailCard mail={mail} />
        <StorageCard storage={storage} />
      </div>

      <DailyReadsTable reads={reads} />

      <div className="workspace-grid overview-grid">
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
