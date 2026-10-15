import type { ReactNode } from "react";
import "../panel.css";
import { prisma } from "@/lib/prisma";
import { requirePanelUser } from "@/lib/panel-auth";
import { getUploadSettings } from "@/lib/settings";
import { UploadSettingsProvider } from "./_components/upload-settings";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  const [uploadSettings, unreadInquiries, pendingReviews] = await Promise.all([
    getUploadSettings(),
    prisma.contactInquiry.count({ where: { readAt: null, archivedAt: null } }),
    prisma.productReview.count({ where: { status: "pending" } }),
  ]);
  return (
    <UploadSettingsProvider value={uploadSettings}>
      <PanelShell user={user} unreadInquiries={unreadInquiries} pendingReviews={pendingReviews}>
        {children}
      </PanelShell>
    </UploadSettingsProvider>
  );
}
