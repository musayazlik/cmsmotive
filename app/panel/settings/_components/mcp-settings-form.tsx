"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import TextField from "@/app/panel/_components/ui/text-field";
import {
  DEFAULT_MCP_NAME,
  MCP_NAME_ERROR,
  MCP_NAME_MAX_LENGTH,
  MCP_TOKEN_PREFIX,
  normalizeMcpName,
  type McpSettings,
} from "@/lib/mcp-settings-shared";
import { issueMcpTokenAction, revokeMcpTokenAction, saveMcpAccessAction } from "../_actions";
import { CopyButton } from "./settings-kit";

type Admin = { id: string; name: string; email: string; role: string };

type Props = {
  settings: McpSettings;
  admins: Admin[];
  /** Absolute URL of the HTTP endpoint. */
  endpoint: string;
  /** Project directory shown in the stdio snippet. */
  projectDir: string;
};

const TOKEN_PLACEHOLDER = "<your-token>";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Snippet({ title, note, code }: { title: string; note: string; code: string }) {
  return (
    <div className="wsnippet">
      <div className="wsnippet-head">
        <div>
          <strong>{title}</strong>
          <span>{note}</span>
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="wcode">{code}</pre>
    </div>
  );
}

export default function McpSettingsForm({ settings, admins, endpoint, projectDir }: Props) {
  const router = useRouter();
  const [name, setName] = useState(settings.name);
  const [httpEnabled, setHttpEnabled] = useState(settings.httpEnabled);
  const [actorUserId, setActorUserId] = useState(settings.actorUserId ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  // A freshly issued token lives only in this component's state: the server
  // keeps its hash, so it cannot be shown again after a reload.
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);
  const [tokenBusy, startToken] = useTransition();

  const serverName = normalizeMcpName(name);
  const nameError = serverName ? undefined : MCP_NAME_ERROR;
  const dirty =
    serverName !== null &&
    (serverName !== settings.name ||
      httpEnabled !== settings.httpEnabled ||
      actorUserId !== (settings.actorUserId ?? ""));
  const missingActor = Boolean(settings.actorUserId) && !admins.some((admin) => admin.id === settings.actorUserId);
  const fallbackAdmin = admins[0];
  const actorOptions = admins.map((admin) => ({
    value: admin.id,
    label: `${admin.name} · ${admin.email}${admin.role === "superadmin" ? " (superadmin)" : ""}`,
  }));

  const status = !settings.httpEnabled
    ? { label: "Off", tone: "wbadge-user" }
    : settings.token
      ? { label: "Live", tone: "wbadge-verified" }
      : { label: "Needs token", tone: "wbadge-pending" };

  function save() {
    setError("");
    setSaved(false);
    if (!serverName) {
      setError(MCP_NAME_ERROR);
      return;
    }
    startSaving(async () => {
      const result = await saveMcpAccessAction(httpEnabled, actorUserId || null, serverName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName(serverName);
      setSaved(true);
      router.refresh();
    });
  }

  function issue() {
    setTokenError("");
    startToken(async () => {
      const result = await issueMcpTokenAction();
      setConfirm(null);
      if (!result.ok) {
        setTokenError(result.error);
        return;
      }
      setFreshToken(result.token);
      router.refresh();
    });
  }

  function revoke() {
    setTokenError("");
    startToken(async () => {
      const result = await revokeMcpTokenAction();
      setConfirm(null);
      if (!result.ok) {
        setTokenError(result.error);
        return;
      }
      setFreshToken(null);
      router.refresh();
    });
  }

  const token = freshToken ?? TOKEN_PLACEHOLDER;
  const snippetName = serverName ?? settings.name;
  const stdioConfig = JSON.stringify(
    { mcpServers: { [snippetName]: { command: "pnpm", args: ["--dir", projectDir, "mcp"] } } },
    null,
    2,
  );
  const httpConfig = JSON.stringify(
    { mcpServers: { [snippetName]: { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );

  return (
    <div className="wsettings-stack">
      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Server</p>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            maxLength={MCP_NAME_MAX_LENGTH}
            placeholder={DEFAULT_MCP_NAME}
            note="The name MCP clients see and use as the key in their configs. The snippets below follow it; clients that are already connected keep the old name until their config is updated."
            error={nameError}
          />
        </div>

        <div className="wsettings-section">
          <div className="wsettings-heading">
            <p className="wsection-label">HTTP endpoint</p>
            <span className={`wbadge ${status.tone}`}>{status.label}</span>
          </div>
          <CheckBox
            checked={httpEnabled}
            onChange={setHttpEnabled}
            label="Serve the MCP endpoint over HTTP"
            note="Remote clients send JSON-RPC requests to the URL below with the access token as a bearer token. Turning this off rejects every request but keeps the token."
          />
          <div className="wsettings-copy-row">
            <code className="wsettings-url">{endpoint}</code>
            <CopyButton value={endpoint} label="Copy URL" />
          </div>
          {httpEnabled && !settings.token ? (
            <p className="wfield-hint-block">Create an access token below; the endpoint refuses requests until one exists.</p>
          ) : null}
        </div>

        <div className="wsettings-section">
          <p className="wsection-label">Identity</p>
          <Select
            label="Act as"
            value={actorUserId}
            onChange={setActorUserId}
            options={actorOptions}
            emptyLabel={fallbackAdmin ? `Oldest admin (${fallbackAdmin.email})` : "Oldest admin"}
            placeholder={missingActor ? "Selected account no longer exists" : undefined}
            note="Posts, uploads and user changes made over MCP are attributed to this account. Applies to both the HTTP endpoint and the local stdio server."
            error={missingActor ? "The saved account was removed or lost its admin role. Pick another one." : undefined}
          />
        </div>

        {error ? (
          <p className="wdialog-error" role="alert" style={{ margin: "0 19px 4px" }}>
            {error}
          </p>
        ) : null}

        <div className="wsettings-foot">
          <span className="wsettings-state" role="status">
            {saved && !dirty ? "Settings saved." : ""}
          </span>
          <button type="button" className="wbtn wbtn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Access token</p>

          {freshToken ? (
            <div className="wtoken-reveal" role="status">
              <strong>Copy the new token now — it will not be shown again.</strong>
              <div className="wsettings-copy-row">
                <code className="wsettings-url">{freshToken}</code>
                <CopyButton value={freshToken} />
              </div>
              <p className="wfield-hint-block">
                Only a hash is stored. If it is lost, create a new one; the old token stops working at once.
              </p>
            </div>
          ) : null}

          {settings.token ? (
            <dl className="wtoken-meta">
              <div>
                <dt>Token</dt>
                <dd>
                  <code>
                    {MCP_TOKEN_PREFIX}••••{settings.token.hint}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(settings.token.createdAt)}</dd>
              </div>
              <div>
                <dt>Last used</dt>
                <dd>{settings.token.lastUsedAt ? formatDateTime(settings.token.lastUsedAt) : "Never"}</dd>
              </div>
            </dl>
          ) : (
            <p className="wfield-hint-block" style={{ marginTop: 0 }}>
              No token has been created yet. The local stdio server does not need one.
            </p>
          )}

          {tokenError ? (
            <p className="wdialog-error" role="alert" style={{ margin: 0 }}>
              {tokenError}
            </p>
          ) : null}

          <div className="wsettings-actions">
            {settings.token ? (
              <>
                <button type="button" className="wbtn wbtn-ghost" onClick={() => setConfirm("rotate")} disabled={tokenBusy}>
                  Regenerate token
                </button>
                <button type="button" className="wbtn wbtn-danger" onClick={() => setConfirm("revoke")} disabled={tokenBusy}>
                  Revoke
                </button>
              </>
            ) : (
              <button type="button" className="wbtn wbtn-primary" onClick={issue} disabled={tokenBusy}>
                {tokenBusy ? "Creating…" : "Create token"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="wtable-card wsettings-card">
        <div className="wsettings-section">
          <p className="wsection-label">Connect a client</p>
          <Snippet
            title="Claude Code"
            note="Remote, over HTTP"
            code={`claude mcp add --transport http ${snippetName} ${endpoint} --header "Authorization: Bearer ${token}"`}
          />
          <Snippet title="Cursor, Claude Desktop and other JSON configs" note="Remote, over HTTP" code={httpConfig} />
          <Snippet title="Local stdio server" note="Runs `pnpm mcp` from a checkout with database access" code={stdioConfig} />
          <p className="wfield-hint-block" style={{ marginTop: 0 }}>
            On Windows, use <code>&quot;command&quot;: &quot;cmd&quot;</code> with{" "}
            <code>[&quot;/c&quot;, &quot;pnpm&quot;, …]</code> if the client cannot start <code>pnpm</code> directly.
            Serve the endpoint over HTTPS only.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "rotate"}
        title="Regenerate the access token?"
        body="A new token is created and the current one stops working immediately. Every client using it has to be updated."
        confirmLabel="Regenerate"
        busy={tokenBusy}
        onConfirm={issue}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        title="Revoke the access token?"
        body="HTTP clients lose access immediately. The local stdio server keeps working."
        confirmLabel="Revoke"
        busy={tokenBusy}
        onConfirm={revoke}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
