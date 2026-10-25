import type { ReactNode } from "react";
import "../panel.css";
import "./workspace-shell.css";
import "./assistant-activity.css";
import { requirePanelUser } from "@/lib/panel-auth";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { panelStore, panelStoreOrigin } from "@/lib/panel-store";
import { getSiteSettings, getUploadSettings } from "@/lib/settings";
import { isLocale } from "@/lib/i18n/config";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings-shared";
import { accessibleStores } from "@/lib/store-access";
import { UploadSettingsProvider } from "./_components/upload-settings";
import { PanelNavigationProvider } from "./_components/panel-navigation";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  const store = await panelStore();
  const [accessSettings, uploadSettings, site, stores, siteOrigin] = await Promise.all([
    getAdminAccessSettings(),
    getUploadSettings(store.id),
    getSiteSettings(store.id),
    accessibleStores(user.id),
    panelStoreOrigin(),
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
        >
          {children}
        </PanelShell>
      </UploadSettingsProvider>
    </PanelNavigationProvider>
  );
}
