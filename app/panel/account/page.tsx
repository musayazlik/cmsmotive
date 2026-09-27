import { requirePanelUser } from "@/lib/panel-auth";
import AccountForm from "./_components/account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requirePanelUser();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> ACCOUNT / MY PROFILE
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Your <em>account.</em>
          </h1>
          <p>
            Your sign-in identity and password. Other account holders — names, roles, e-mail addresses —
            stay in the Users section; this page is only about your own access.
          </p>
        </div>
        <span className="workspace-index">ACCOUNT</span>
      </div>

      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Identity</p>
          <div className="winbox-meta">
            <div>
              <span>Name</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span>E-mail</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user.role}</strong>
            </div>
          </div>
          <p className="wfield-hint-block">
            Name and e-mail are managed in <a href="/panel/users">Users</a> — changing the e-mail there
            signs you in with the new address next time.
          </p>
        </div>

        <div className="wsettings-section">
          <p className="wsection-label">Change password</p>
          <AccountForm />
        </div>
      </div>
    </>
  );
}
