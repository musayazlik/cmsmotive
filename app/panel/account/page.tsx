import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import AccountForm from "./_components/account-form";
import AccountNameForm from "./_components/account-name-form";

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
            Your own name, sign-in identity and password. Other account holders — names, roles, e-mail
            addresses — stay in the Users section.
          </p>
        </div>
        <span className="workspace-index">ACCOUNT</span>
      </div>

      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Identity</p>
          <AccountNameForm initialName={user.name} />
          <div className="winbox-meta">
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
            Your name can be changed here. E-mail addresses are managed in{" "}
            <Link href="/panel/users">Users</Link> — changing the e-mail there signs you in with the new
            address next time.
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
