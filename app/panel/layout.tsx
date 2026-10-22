import type { ReactNode } from "react";
import "../panel.css";
import { prisma } from "@/lib/prisma";
import { requirePanelUser } from "@/lib/panel-auth";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getUploadSettings } from "@/lib/settings";
import { UploadSettingsProvider } from "./_components/upload-settings";
import { PanelNavigationProvider } from "./_components/panel-navigation";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  const [accessSettings, uploadSettings, unreadInquiries, pendingReviews, pendingComments] = await Promise.all([
    getAdminAccessSettings(),
    getUploadSettings(),
    prisma.contactInquiry.count({ where: { readAt: null, archivedAt: null } }),
    prisma.productReview.count({ where: { status: "pending" } }),
    prisma.postComment.count({ where: { status: "pending" } }),
  ]);
  return (
    <PanelNavigationProvider basePath={accessSettings.panelPath}>
      <UploadSettingsProvider value={uploadSettings}>
        <PanelShell user={user} unreadInquiries={unreadInquiries} pendingReviews={pendingReviews} pendingComments={pendingComments}>
          {children}
        </PanelShell>
      </UploadSettingsProvider>
    </PanelNavigationProvider>
  );
}
