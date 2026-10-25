"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import TextField from "@/app/panel/_components/ui/text-field";
import { useToast } from "@/app/panel/_components/ui/toast";
import type { AiModelInfo } from "@/app/panel/blog/_ai";
import ModelPicker from "@/app/panel/blog/_components/model-picker";
import { PAIRING_TTL_MS, type TelegramSettings } from "@/lib/telegram-settings-shared";
import {
  connectTelegramBotAction,
  createTelegramPairingAction,
  disconnectTelegramBotAction,
  removeTelegramLinkAction,
  saveTelegramOptionsAction,
} from "../_actions";
import { CopyButton, EnvFacts, SettingsFoot, useSettingsForm } from "./settings-kit";

export type WebhookState =
  | { kind: "active"; url: string; pending: number; lastError: string | null }
  | { kind: "wrong-url"; url: string }
  | { kind: "none" }
  | { kind: "unreachable"; error: string };

type Props = {
  settings: TelegramSettings;
  webhook: WebhookState | null;
  /** The origin is https, so Telegram can call the webhook. */
  httpsOrigin: boolean;
  openRouterConfigured: boolean;
  /** Settings → AI text and image models ("" = automatic), inherited when Telegram picks none. */
  aiTextModel: string;
  aiImageModel: string;
};

const EXAMPLES = [
  "Write a draft post about accessibility in TYPO3 14, about 800 words, and create a cover for it.",
  "Make the cover of “<post title>” darker and add more lime accents.",
  "Publish the post about design systems in the Guides category with the tags TYPO3 and UX.",
  "Which reviews are pending? Approve the 5-star ones.",
  "(photo) Use this as the cover of the latest draft.",
];

function webhookFact(webhook: WebhookState | null, httpsOrigin: boolean) {
  if (!webhook) return { label: "Webhook", value: "—" };
  switch (webhook.kind) {
    case "active":
      return webhook.lastError
        ? { label: "Webhook", value: `Error: ${webhook.lastError}`, ok: false }
        : { label: "Webhook", value: webhook.pending ? `Active · ${webhook.pending} queued` : "Active", ok: true };
    case "wrong-url":
      return { label: "Webhook", value: `Points elsewhere: ${webhook.url}`, ok: false };
    case "unreachable":
      return { label: "Webhook", value: webhook.error, ok: false };
    case "none":
      return {
        label: "Webhook",
        value: httpsOrigin ? "Not registered — reconnect the bot" : "None (local) — run pnpm telegram:poll",
        ok: !httpsOrigin,
      };
  }
}

function BotCard({ settings, webhook, httpsOrigin }: Pick<Props, "settings" | "webhook" | "httpsOrigin">) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [token, setToken] = useState("");
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const bot = settings.bot;

  function connect() {
    start(async () => {
      const result = await connectTelegramBotAction(token);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      setToken("");
      setReplacing(false);
      showToast(
        result.webhook
          ? `Connected @${result.username}. The webhook is registered.`
          : `Connected @${result.username}. This origin is not HTTPS, so run pnpm telegram:poll locally.`,
        "success",
      );
      router.refresh();
    });
  }

  function disconnect() {
    start(async () => {
      const result = await disconnectTelegramBotAction();
      setConfirm(false);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <div className="wsettings-heading">
          <p className="wsection-label">Bot</p>
          <span className={`wbadge ${bot ? "wbadge-verified" : "wbadge-user"}`}>{bot ? "Connected" : "Not connected"}</span>
        </div>
        {bot ? (
          <EnvFacts
            facts={[
              { label: "Bot", value: `@${bot.username}` },
              { label: "Token", value: `••••${bot.tokenHint}` },
              webhookFact(webhook, httpsOrigin),
            ]}
          />
        ) : (
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> (
            <code>/newbot</code>), then paste the token it gives you. Only accounts you link below can use it.
          </p>
        )}
        {!bot || replacing ? (
          <>
            {bot ? (
              <p className="wfield-hint-block" style={{ marginTop: 0 }}>
                Only needed after revoking the token in @BotFather (<code>/revoke</code>) or to switch to another bot.
                Linked accounts are kept.
              </p>
            ) : null}
            <div className="wsettings-copy-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label={bot ? "New bot token" : "Bot token"}
                  hideLabel
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={setToken}
                  placeholder="123456789:AA…"
                />
              </div>
              <button type="button" className="wbtn wbtn-primary" onClick={connect} disabled={busy || !token.trim()}>
                {busy ? "Connecting…" : bot ? "Save token" : "Connect"}
              </button>
              {bot ? (
                <button
                  type="button"
                  className="wbtn wbtn-ghost"
                  onClick={() => {
                    setReplacing(false);
                    setToken("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </>
        ) : null}
        {bot ? (
          <div className="wsettings-actions">
            <a className="wbtn wbtn-ghost" href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">
              Open in Telegram
            </a>
            {!replacing ? (
              <button type="button" className="wbtn wbtn-ghost" onClick={() => setReplacing(true)} disabled={busy}>
                Replace token
              </button>
            ) : null}
            <button type="button" className="wbtn wbtn-danger" onClick={() => setConfirm(true)} disabled={busy}>
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Disconnect the bot?"
        body="The webhook is removed and the token is deleted from the panel. Linked accounts are kept for when you reconnect."
        confirmLabel="Disconnect"
        busy={busy}
        onConfirm={disconnect}
        onClose={() => setConfirm(false)}
      />
      {toast}
    </div>
  );
}

type Catalogue = { text: AiModelInfo[]; image: AiModelInfo[] };

/**
 * One model slot: "automatic" (or inherited from Settings → AI) by default,
 * a searchable picker over the models that fit the job once unticked.
 */
function ModelChoice({
  label,
  automaticLabel,
  note,
  models,
  value,
  onChange,
}: {
  label: string;
  automaticLabel: string;
  note: string;
  models: AiModelInfo[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const unknown = Boolean(value) && models !== null && !models.some((model) => model.id === value);
  return (
    <div className="wsettings-quality">
      <CheckBox
        checked={!value}
        onChange={(automatic) => onChange(automatic ? "" : (models?.[0]?.id ?? ""))}
        label={`${label}: ${automaticLabel}`}
        note={note}
        disabled={!models?.length && !value}
      />
      {value && models?.length ? (
        <ModelPicker label={label} models={models} value={value} onChange={onChange} />
      ) : value ? (
        <p className="wfield-hint-block">
          Saved: <code>{value}</code>
        </p>
      ) : null}
      {unknown ? (
        <p className="wfield-error" role="alert">
          <code>{value}</code> is not offered for this job any more; the bot falls back to the automatic choice.
        </p>
      ) : null}
    </div>
  );
}

function AssistantCard({
  settings,
  openRouterConfigured,
  aiTextModel,
  aiImageModel,
}: Pick<Props, "settings" | "openRouterConfigured" | "aiTextModel" | "aiImageModel">) {
  const form = useSettingsForm(
    {
      enabled: settings.enabled,
      model: settings.model,
      contentModel: settings.contentModel,
      imageModel: settings.imageModel,
    },
    saveTelegramOptionsAction,
  );
  const { values, set } = form;
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");

  useEffect(() => {
    if (!openRouterConfigured) return;
    let cancelled = false;
    fetch("/api/admin/ai/models")
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) setCatalogueError(payload.error ?? "The model list could not be loaded.");
        else setCatalogue({ text: payload.text as AiModelInfo[], image: payload.image as AiModelInfo[] });
      })
      .catch(() => !cancelled && setCatalogueError("Could not reach the server."));
    return () => {
      cancelled = true;
    };
  }, [openRouterConfigured]);

  // Each slot lists only the models that can do its job.
  const chatModels = catalogue ? catalogue.text.filter((model) => model.tools) : null;
  const inherited = (id: string) => (id ? `same as Settings → AI (${id})` : "same as Settings → AI (automatic)");

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Assistant</p>
        <CheckBox
          checked={values.enabled}
          onChange={(checked) => set("enabled", checked)}
          label="Answer messages"
          note="When off, the bot ignores every message but stays connected."
        />
        <EnvFacts
          facts={[
            {
              label: "OpenRouter",
              value: !openRouterConfigured
                ? "OPENROUTER_API_KEY is empty"
                : catalogue
                  ? `${chatModels!.length} chat · ${catalogue.text.length} text · ${catalogue.image.length} image models`
                  : catalogueError || "Loading models…",
              ok: openRouterConfigured && !catalogueError,
            },
          ]}
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Models</p>
        <ModelChoice
          label="Chat model"
          automaticLabel="choose automatically"
          note="Talks to you and calls the panel tools. Only models with tool calling are listed; prefers Claude Sonnet, then GPT-5 mini and Gemini Flash."
          models={chatModels}
          value={values.model}
          onChange={(id) => set("model", id)}
        />
        <ModelChoice
          label="Content model"
          automaticLabel={inherited(aiTextModel)}
          note="Writes and rewrites post texts. Lists text models."
          models={catalogue?.text ?? null}
          value={values.contentModel}
          onChange={(id) => set("contentModel", id)}
        />
        <ModelChoice
          label="Image model"
          automaticLabel={inherited(aiImageModel)}
          note="Generates and edits covers and other images. Lists only models that output images."
          models={catalogue?.image ?? null}
          value={values.imageModel}
          onChange={(id) => set("imageModel", id)}
        />
        <p className="wfield-hint-block" style={{ marginTop: 0 }}>
          The panel&apos;s own AI assistant keeps using <Link href="/panel/settings/ai">Settings → AI</Link>. AI
          drafts and images are created directly; edits, publishing and deletions wait for your Confirm tap in the chat.
        </p>
      </div>
      <SettingsFoot form={form} />
    </div>
  );
}

function AccountsCard({ settings }: Pick<Props, "settings">) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [pairing, setPairing] = useState<{ url: string; code: string; expiresAt: number } | null>(null);
  const [remove, setRemove] = useState<number | null>(null);
  const [busy, start] = useTransition();

  // A linked account shows up once the person opened the link; poll briefly while a code is out.
  useEffect(() => {
    if (!pairing) return;
    const timer = setInterval(() => {
      if (Date.now() > pairing.expiresAt) setPairing(null);
      else router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [pairing, router]);

  const linkCount = settings.links.length;
  useEffect(() => {
    setPairing(null);
  }, [linkCount]);

  function createLink() {
    start(async () => {
      const result = await createTelegramPairingAction();
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      setPairing({ url: result.url, code: result.code, expiresAt: Date.now() + PAIRING_TTL_MS });
    });
  }

  function unlink(telegramUserId: number) {
    start(async () => {
      const result = await removeTelegramLinkAction(telegramUserId);
      setRemove(null);
      if (!result.ok) showToast(result.error);
      router.refresh();
    });
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Linked accounts</p>
        {linkCount === 0 ? (
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            Nobody can use the bot yet. Link your own Telegram account; the bot then acts as your panel account.
          </p>
        ) : (
          <ul className="wlink-list">
            {settings.links.map((link) => (
              <li key={link.telegramUserId}>
                <div>
                  <strong>
                    {link.name || "Telegram user"}
                    {link.username ? ` · @${link.username}` : ""}
                  </strong>
                  <small>
                    Acts as {link.userEmail ?? "a deleted account"} · linked{" "}
                    {new Date(link.linkedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </small>
                </div>
                <button type="button" className="wbtn wbtn-ghost" onClick={() => setRemove(link.telegramUserId)} disabled={busy}>
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        {pairing ? (
          <div className="wtoken-reveal" role="status">
            <strong>Open the link on the phone or computer where you use Telegram, then tap Start.</strong>
            <div className="wsettings-actions">
              <a className="wbtn wbtn-primary" href={pairing.url} target="_blank" rel="noreferrer">
                Open in Telegram
              </a>
            </div>
            <p className="wfield-hint-block">
              If the chat opens without linking (common when it is already open), paste this code into it:
            </p>
            <div className="wsettings-copy-row">
              <code className="wsettings-url">{pairing.code}</code>
              <CopyButton value={pairing.code} />
            </div>
            <p className="wfield-hint-block">The code works once and expires in 15 minutes.</p>
          </div>
        ) : (
          <div className="wsettings-actions">
            <button type="button" className="wbtn wbtn-primary" onClick={createLink} disabled={busy || !settings.bot}>
              Link my Telegram
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={remove !== null}
        title="Unlink this account?"
        body="The bot stops answering this Telegram account immediately."
        confirmLabel="Unlink"
        busy={busy}
        onConfirm={() => remove !== null && unlink(remove)}
        onClose={() => setRemove(null)}
      />
      {toast}
    </div>
  );
}

export default function TelegramSettingsForm(props: Props) {
  return (
    <div className="wsettings-stack">
      <BotCard settings={props.settings} webhook={props.webhook} httpsOrigin={props.httpsOrigin} />
      <AssistantCard
        settings={props.settings}
        openRouterConfigured={props.openRouterConfigured}
        aiTextModel={props.aiTextModel}
        aiImageModel={props.aiImageModel}
      />
      <AccountsCard settings={props.settings} />
      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Things to ask</p>
          <ul className="wexample-list">
            {EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            The bot remembers the last turns of the chat, so follow-ups like “make it shorter” work. Send /new to start over.
          </p>
        </div>
      </div>
    </div>
  );
}
