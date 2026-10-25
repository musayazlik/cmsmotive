import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import UsersManager from "./users-manager";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requirePanelUser();

  // The seeded superadmin is hidden from the panel, so it is not counted either.
  const totalUsers = await prisma.storeMember.count({ where: { storeId: (await panelStore()).id, user: { role: { not: "superadmin" } } } });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> ACCOUNT / USERS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            People with<br />
            <em>access.</em>
          </h1>
          <p>
            Members of this store. Admins manage the panel for this store; standard members use their own account.
            Add an existing account by e-mail, or create a new one. Roles and removals apply to this store only.
          </p>
        </div>
        <span className="workspace-index">02 / 05</span>
      </div>

      <div className="wpage-stats">
        <div>
          <span>Total accounts</span>
          <strong>{totalUsers}</strong>
        </div>
        <div>
          <span>Signed in as</span>
          <strong>{session.email}</strong>
        </div>
      </div>

      <UsersManager />
    </>
  );
}
