import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import UsersManager from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requirePanelUser();

  // The seeded superadmin is hidden from the panel, so it is not counted either.
  const totalUsers = await prisma.user.count({ where: { role: { not: "superadmin" } } });

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
            Every account that can sign in to the workspace. Admins reach the full panel, standard accounts see their
            own work only. Search, add, edit or remove accounts — every change is applied immediately.
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
