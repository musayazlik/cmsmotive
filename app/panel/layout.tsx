import type { ReactNode } from "react";
import "../panel.css";
import { prisma } from "@/lib/prisma";
import { requirePanelUser } from "@/lib/panel-auth";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { panelStore, panelStoreOrigin } from "@/lib/panel-store";
import { getSiteSettings, getUploadSettings } from "@/lib/settings";
import { isLocale } from "@/lib/i18n/config";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings-shared";
import { listStores } from "@/lib/stores";
import { UploadSettingsProvider } from "./_components/upload-settings";
import { PanelNavigationProvider } from "./_components/panel-navigation";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  const store = await panelStore();
  const [accessSettings, uploadSettings, site, stores, siteOrigin, unreadInquiries, pendingReviews, pendingComments] = await Promise.all([
    getAdminAccessSettings(),
    getUploadSettings(store.id),
    getSiteSettings(store.id),
    listStores(),
    panelStoreOrigin(),
    prisma.contactInquiry.count({ where: { storeId: store.id, readAt: null, archivedAt: null } }),
    prisma.productReview.count({ where: { storeId: store.id, status: "pending" } }),
    prisma.postComment.count({ where: { post: { storeId: store.id }, status: "pending" } }),
  ]);
  return (
    <PanelNavigationProvider basePath={accessSettings.panelPath}>
      <link rel="stylesheet" href="/assets/css/fonts.css" precedence="default" />
      <UploadSettingsProvider value={uploadSettings}>
        <PanelShell
          user={user}
          stores={stores.map(({ id, name }) => ({ id, name }))}
          storeId={store.id}
          siteOrigin={siteOrigin}
          systemLanguage={isLocale(site.systemLanguage) ? site.systemLanguage : DEFAULT_SITE_SETTINGS.systemLanguage}
          unreadInquiries={unreadInquiries}
          pendingReviews={pendingReviews}
          pendingComments={pendingComments}
        >
          {children}
        </PanelShell>
      </UploadSettingsProvider>
    </PanelNavigationProvider>
  );
}
