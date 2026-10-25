import type { Metadata } from "next";
import BackupManager from "./backup-manager";
import { requirePanelUser } from "@/lib/panel-auth";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Export / Import · CMSMotive" };

export default async function BackupPage({ searchParams }: { searchParams: Promise<{ restored?: string }> }) {
  if ((await requirePanelUser()).role !== "superadmin") notFound();
  const { restored } = await searchParams;
  return (
    <>
      <div className="workspace-eyebrow">WORKSPACE / EXPORT &amp; IMPORT</div>
      <div className="workspace-intro">
        <div>
          <h1>Keep a <em>copy.</em></h1>
          <p>Export your workspace to a backup file, or restore content and panel settings from an earlier copy.</p>
        </div>
        <span className="workspace-index">BACKUP</span>
      </div>
      <BackupManager restored={restored === "1"} />
    </>
  );
}
