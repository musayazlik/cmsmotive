import { ADMIN_ROLES } from "@/lib/admin-guard";
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
  getReviewSettings,
  getSeoSettings,
  getSiteSettings,
  getUploadSettings,
} from "@/lib/settings";
import { WEBP_QUALITY_MAX, WEBP_QUALITY_MIN } from "@/lib/upload-settings-shared";
import AiSettingsForm from "./_components/ai-settings-form";
import EmailSettingsForm from "./_components/email-settings-form";
import GeneralSettingsForm from "./_components/general-settings-form";
import McpSettingsForm from "./_components/mcp-settings-form";
import MediaSettingsForm from "./_components/media-settings-form";
import ReviewSettingsForm from "./_components/review-settings-form";
import SeoSettingsForm from "./_components/seo-settings-form";
import TelegramSettingsForm, { type WebhookState } from "./_components/telegram-settings-form";
import SettingsTabs from "./_components/settings-tabs";
import { resolveSettingsTab, type SettingsTabId } from "./_tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = resolveSettingsTab((await searchParams).tab);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> WORKSPACE / SETTINGS / {tab.label.toUpperCase()}
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Tune the <em>workspace.</em>
          </h1>
          <p>{tab.intro}</p>
        </div>
        <span className="workspace-index">SETTINGS</span>
      </div>

      <SettingsTabs active={tab.id} />
      <SettingsPanel tab={tab.id} />
    </>
  );
}

async function SettingsPanel({ tab }: { tab: SettingsTabId }) {
  switch (tab) {
    case "general":
      return <GeneralSettingsForm settings={await getSiteSettings()} />;
    case "seo":
      return (
        <SeoSettingsForm
          settings={await getSeoSettings()}
          origin={await siteOrigin()}
          defaultShareImage={DEFAULT_SHARE_IMAGE.url}
        />
      );
    case "reviews":
      return (
        <ReviewSettingsForm
          settings={await getReviewSettings()}
          recaptchaConfigured={Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY)}
        />
      );
    case "email":
      return <EmailPanel />;
    case "ai":
      return <AiSettingsForm settings={await getAiSettings()} configured={isOpenRouterConfigured()} />;
    case "telegram":
      return <TelegramPanel />;
    case "media":
      return <MediaPanel />;
    case "mcp":
      return <McpPanel />;
  }
}

async function EmailPanel() {
  const settings = await getEmailSettings();
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
  const [settings, config, origin, ai] = await Promise.all([
    getTelegramSettings(),
    getTelegramConfig(),
    siteOrigin(),
    getAiSettings(),
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
  const settings = await getUploadSettings();
  return (
    <>
      <MediaSettingsForm settings={settings} />
      <p className="wsettings-scope">
        Quality range {WEBP_QUALITY_MIN}–{WEBP_QUALITY_MAX}. Applies to theme, extension, blog and media
        library uploads; existing files in storage keep their current format.
      </p>
    </>
  );
}

async function McpPanel() {
  const [settings, admins, origin] = await Promise.all([
    getMcpSettings(),
    prisma.user.findMany({
      where: { role: { in: [...ADMIN_ROLES] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    siteOrigin(),
  ]);
  // The stdio command runs from a local checkout; outside development the
  // server's own directory would only mislead, so a placeholder is shown.
  const projectDir =
    process.env.NODE_ENV === "development" ? process.cwd().replace(/\\/g, "/") : "/path/to/cmsmotive";

  return (
    <McpSettingsForm
      settings={settings}
      admins={admins}
      endpoint={`${origin}/api/mcp`}
      projectDir={projectDir}
    />
  );
}
