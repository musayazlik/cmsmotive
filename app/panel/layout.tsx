import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requirePanelUser } from "@/lib/panel-auth";
import { getUploadSettings } from "@/lib/settings";
import { UploadSettingsProvider } from "./_components/upload-settings";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  const [uploadSettings, unreadInquiries] = await Promise.all([
    getUploadSettings(),
    prisma.contactInquiry.count({ where: { readAt: null, archivedAt: null } }),
  ]);
  return (
    <UploadSettingsProvider value={uploadSettings}>
      <PanelShell user={user} unreadInquiries={unreadInquiries}>
        {children}
      </PanelShell>
    </UploadSettingsProvider>
  );
}
