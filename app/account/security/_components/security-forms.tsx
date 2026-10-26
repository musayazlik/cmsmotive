"use client";

import { useActionState, useState, useTransition } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import {
  changeEmailAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  setPasswordAction,
  unlinkGoogleAction,
  type SecurityState,
} from "../_actions";

const idle: SecurityState = { status: "idle", message: "" };

function Feedback({ state }: { state: SecurityState }) {
  if (state.status === "error" && state.message)
    return (
      <p className="wdialog-error" role="alert">
        {state.message}
      </p>
    );
  return null;
}

/** First password for an account that so far signs in only with Google. */
export function SetPasswordForm({ locale: l }: { locale: Locale }) {
  const [state, submit, pending] = useActionState(setPasswordAction, idle);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <form className="wform" action={submit}>
      <TextField id="security-set-password" name="password" type="password" label={copy(l, "New password", "Neues Passwort", "Yeni şifre")} hint={copy(l, "At least 8 characters.", "Mindestens 8 Zeichen.", "En az 8 karakter.")} value={password} onChange={setPassword} autoComplete="new-password" disabled={pending} />
      <TextField id="security-set-confirm" name="confirm" type="password" label={copy(l, "Repeat the password", "Passwort wiederholen", "Şifreyi tekrarlayın")} value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={pending} />
      <Feedback state={state} />
      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">{state.status === "ok" ? state.message : ""}</span>
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || !password || !confirm}>
          {pending ? copy(l, "Saving…", "Wird gespeichert…", "Kaydediliyor…") : copy(l, "Set password", "Passwort festlegen", "Şifre belirle")}
        </button>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ locale: l, needsPassword }: { locale: Locale; needsPassword: boolean }) {
  const [state, submit, pending] = useActionState(changeEmailAction, idle);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="wform" action={submit}>
      <TextField id="security-email" name="email" type="email" label={copy(l, "New email address", "Neue E-Mail-Adresse", "Yeni e-posta adresi")} value={email} onChange={setEmail} autoComplete="email" disabled={pending} />
      {needsPassword && (
        <TextField id="security-email-password" name="password" type="password" label={copy(l, "Current password", "Aktuelles Passwort", "Mevcut şifre")} value={password} onChange={setPassword} autoComplete="current-password" disabled={pending} />
      )}
      <Feedback state={state} />
      {state.status === "ok" && <p className="customer-form-success" role="status">{state.message}</p>}
      <div className="wsettings-foot">
        <span />
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || !email || (needsPassword && !password)}>
          {pending ? copy(l, "Sending…", "Wird gesendet…", "Gönderiliyor…") : copy(l, "Send confirmation link", "Bestätigungslink senden", "Onay bağlantısı gönder")}
        </button>
      </div>
    </form>
  );
}

export type SessionRow = { id: string; device: string; ip: string | null; lastActive: string; current: boolean };

export function SessionList({ sessions, locale: l }: { sessions: SessionRow[]; locale: Locale }) {
  const [pending, startTransition] = useTransition();
  const others = sessions.filter((session) => !session.current).length;
  return (
    <>
      <ul className="customer-records">
        {sessions.map((session) => (
          <li className="customer-record" key={session.id}>
            <div>
              <strong>{session.device}</strong>
              <p>
                {session.ip ? `${session.ip} · ` : ""}
                {copy(l, "Last active", "Zuletzt aktiv", "Son etkinlik")} {session.lastActive}
              </p>
            </div>
            {session.current ? (
              <span className="customer-status" data-positive="true">{copy(l, "This device", "Dieses Gerät", "Bu cihaz")}</span>
            ) : (
              <button className="wbtn wbtn-ghost" type="button" disabled={pending} onClick={() => startTransition(() => revokeSessionAction(session.id))}>
                {copy(l, "Sign out", "Abmelden", "Çıkış yap")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <div className="customer-card-note">
          <p>{copy(l, "Don't recognise a device? Sign it out and change your password.", "Sie erkennen ein Gerät nicht? Melden Sie es ab und ändern Sie Ihr Passwort.", "Tanımadığınız bir cihaz mı var? Oturumunu kapatın ve şifrenizi değiştirin.")}</p>
          <button className="wbtn" type="button" disabled={pending} onClick={() => startTransition(() => revokeOtherSessionsAction())}>
            {copy(l, "Sign out all other devices", "Alle anderen Geräte abmelden", "Diğer tüm cihazlardan çıkış yap")}
          </button>
        </div>
      )}
    </>
  );
}

/** Connect or disconnect Google as a sign-in method. */
export function GoogleConnection({ linked, locale: l }: { linked: boolean; locale: Locale }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function link() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/link-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: `/account/security?lang=${l}&google=linked`,
          errorCallbackURL: `/account/security?lang=${l}&google=failed`,
          disableRedirect: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const url = typeof data.url === "string" ? new URL(data.url) : null;
      if (!response.ok || !url || url.protocol !== "https:" || url.hostname !== "accounts.google.com") throw new Error();
      window.location.assign(url.href);
    } catch {
      setError(copy(l, "Google could not be connected. Try again.", "Google konnte nicht verbunden werden. Bitte erneut versuchen.", "Google bağlanamadı. Tekrar deneyin."));
      setPending(false);
    }
  }
  async function unlink() {
    setPending(true);
    setError("");
    const result = await unlinkGoogleAction();
    if (result.status === "error") setError(result.message);
    setPending(false);
  }
  return (
    <div className="customer-connection">
      <div>
        <strong>Google</strong>
        <p>
          {linked
            ? copy(l, "Connected: you can sign in with your Google account.", "Verbunden: Sie können sich mit Ihrem Google-Konto anmelden.", "Bağlı: Google hesabınızla giriş yapabilirsiniz.")
            : copy(l, "Not connected. The Google account must use the same email address.", "Nicht verbunden. Das Google-Konto muss dieselbe E-Mail-Adresse verwenden.", "Bağlı değil. Google hesabı aynı e-posta adresini kullanmalı.")}
        </p>
        {error && <p className="wdialog-error" role="alert">{error}</p>}
      </div>
      <button className={linked ? "wbtn wbtn-ghost" : "wbtn"} type="button" disabled={pending} onClick={linked ? unlink : link}>
        {linked ? copy(l, "Disconnect", "Trennen", "Bağlantıyı kaldır") : copy(l, "Connect", "Verbinden", "Bağla")}
      </button>
    </div>
  );
}
