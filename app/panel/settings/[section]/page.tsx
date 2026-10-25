import { storeAdminWhere } from "@/lib/store-access";
import { getLegalSettings } from "@/lib/legal";
import LegalSettingsForm from "../_components/legal-settings-form";
import { requirePanelUser } from "@/lib/panel-auth";
import { getAdminAccessSettings } from "@/lib/admin-access";
import SecuritySettingsForm from "../_components/security-settings-form";
import { getMcpSettings } from "@/lib/mcp-settings";
import { isOpenRouterConfigured } from "@/lib/openrouter";
import { isPlunkConfigured } from "@/lib/plunk";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHARE_IMAGE, siteOrigin } from "@/lib/seo";
import { getTelegramConfig, getTelegramSettings } from "@/lib/telegram-settings";
import { getWebhookInfo } from "@/telegram/api";
import {
  contactRecipient,
  getAiSettings,
  getEmailSettings,
  getMaintenanceSettings,
  getReviewSettings,
  getSeoSettings,
  getSiteSettings,
  getUploadSettings,
} from "@/lib/settings";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN } from "@/lib/upload-settings-shared";
import AiSettingsForm from "../_components/ai-settings-form";
import EmailSettingsForm from "../_components/email-settings-form";
import GeneralSettingsForm from "../_components/general-settings-form";
import MaintenanceSettingsForm from "../_components/maintenance-settings-form";
import McpSettingsForm from "../_components/mcp-settings-form";
import MediaSettingsForm from "../_components/media-settings-form";
import ReviewSettingsForm from "../_components/review-settings-form";
import SeoSettingsForm from "../_components/seo-settings-form";
import TelegramSettingsForm, { type WebhookState } from "../_components/telegram-settings-form";
import { notFound } from "next/navigation";
import { SETTINGS_TABS, type SettingsTabId } from "../_tabs";
import { panelStore, panelStoreOrigin } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

/** One settings page per section; the sidebar group lists them under Settings. */
export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const user = await requirePanelUser();
  const { section } = await params;
  const tab = SETTINGS_TABS.find((entry) => entry.id === section);
  if (!tab) notFound();
  if (section === "security" && user.role !== "superadmin") notFound();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> WORKSPACE / SETTINGS / {tab.label.toUpperCase()}
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            {tab.label} <em>settings.</em>
          </h1>
          <p>{tab.intro}</p>
        </div>
        <span className="workspace-index">SETTINGS</span>
      </div>

      <SettingsPanel tab={tab.id} />
    </>
  );
}

async function SettingsPanel({ tab }: { tab: SettingsTabId }) {
  const storeId = (await panelStore()).id;
  switch (tab) {
    case "legal":
      return <LegalSettingsForm settings={await getLegalSettings(storeId)} />;
    case "security":
      return <SecuritySettingsForm settings={await getAdminAccessSettings()} origin={await siteOrigin()} />;
    case "general":
      return <GeneralSettingsForm settings={await getSiteSettings(storeId)} />;
    case "seo":
      return (
        <SeoSettingsForm
          settings={await getSeoSettings(storeId)}
          origin={await panelStoreOrigin()}
          defaultShareImage={DEFAULT_SHARE_IMAGE.url}
        />
      );
    case "reviews":
      return (
        <ReviewSettingsForm
          settings={await getReviewSettings(storeId)}
          recaptchaConfigured={Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY)}
        />
      );
    case "maintenance":
      return <MaintenanceSettingsForm settings={await getMaintenanceSettings(storeId)} />;
    case "email":
      return <EmailPanel />;
    case "ai":
      return <AiSettingsForm settings={await getAiSettings(storeId)} configured={isOpenRouterConfigured()} />;
    case "telegram":
      return <TelegramPanel />;
    case "media":
      return <MediaPanel />;
    case "mcp":
      return <McpPanel />;
  }
}

async function EmailPanel() {
  const storeId = (await panelStore()).id;
  const settings = await getEmailSettings(storeId);
  return (
    <EmailSettingsForm
      settings={settings}
      plunkConfigured={isPlunkConfigured()}
      fromAddress={process.env.PLUNK_FROM_EMAIL || null}
      fallbackRecipient={contactRecipient({ ...settings, contactRecipient: "" })}
    />
  );
}

async function TelegramPanel() {
  const storeId = (await panelStore()).id;
  const [settings, config, origin, ai] = await Promise.all([
    getTelegramSettings(storeId),
    getTelegramConfig(storeId),
    panelStoreOrigin(),
    getAiSettings(storeId),
  ]);
  let webhook: WebhookState | null = null;
  if (config.token) {
    try {
      const info = await getWebhookInfo(config.token);
      const expected = `${config.origin ?? origin}/api/telegram/webhook`;
      webhook = !info.url
        ? { kind: "none" }
        : info.url !== expected
          ? { kind: "wrong-url", url: info.url }
          : { kind: "active", url: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null };
    } catch (error) {
      webhook = { kind: "unreachable", error: error instanceof Error ? error.message : "Telegram is unreachable." };
    }
  }
  return (
    <TelegramSettingsForm
      settings={settings}
      webhook={webhook}
      httpsOrigin={origin.startsWith("https://")}
      openRouterConfigured={isOpenRouterConfigured()}
      aiTextModel={ai.textModel}
      aiImageModel={ai.imageModel}
    />
  );
}

async function MediaPanel() {
  const storeId = (await panelStore()).id;
  const settings = await getUploadSettings(storeId);
  return (
    <>
      <MediaSettingsForm settings={settings} />
      <p className="wsettings-scope">
        Quality range {WEBP_QUALITY_MIN}–{WEBP_QUALITY_MAX}. Applies to product, blog and media library uploads;
        existing files in storage keep their current format.
      </p>
    </>
  );
}

async function McpPanel() {
  const storeId = (await panelStore()).id;
  const [settings, admins, origin] = await Promise.all([
    getMcpSettings(storeId),
    prisma.user.findMany({
      where: storeAdminWhere(storeId),
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    panelStoreOrigin(),
  ]);
  // The stdio command runs from a local checkout; outside development the
  // server's own directory would only mislead, so a placeholder is shown.
  const projectDir = process.env.NODE_ENV === "development" ? process.cwd().replace(/\\/g, "/") : "/path/to/cmsmotive";

  return <McpSettingsForm settings={settings} admins={admins.map((admin) => ({ ...admin, role: admin.role === "superadmin" ? "superadmin" : "admin" }))} endpoint={`${origin}/api/mcp`} projectDir={projectDir} />;
}
