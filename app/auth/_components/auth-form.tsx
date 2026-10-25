"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuthContent, AuthField, AuthPageName } from "./auth-content";
import { queueAccountNotice, showAccountToast } from "@/public/assets/js/account-feedback.js";
import { authText } from "@/lib/auth-copy";
import { copy } from "@/lib/legal-copy";
import { localizePath, type Locale } from "@/lib/i18n/config";

/** Query parameters the account flows hand each other between pages. */
export type AuthQuery = { email?: string; token?: string; error?: string; reset?: string; next?: string };

type Status = { message: string; isError: boolean } | null;

const PENDING_LABELS: Record<AuthPageName, string> = {
  "sign-in": "Signing in…",
  "sign-up": "Creating account…",
  "forgot-password": "Sending reset link…",
  "reset-password": "Updating password…",
  "verify-email": "Sending verification…",
};

/** Same posts the former auth-live script made; better-auth answers behind /api/auth. */
async function authPost(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error?.message || "Please try again.");
  return data;
}

/** Mount-time status: reset pages without a token and finished resets explain themselves. */
function initialStatus(page: AuthPageName, query: AuthQuery): Status {
  if (page === "sign-in" && query.error) return {message:"Google sign-in could not be completed. Try again or use your email address.",isError:true};
  if (page === "sign-in" && query.reset === "success") {
    return { message: "Your password has been updated. You can sign in now.", isError: false };
  }
  if (page === "reset-password" && !query.token) {
    return {
      message: query.error ? "This reset link is invalid or expired. Request a new one." : "Open the link in your reset email to choose a new password.",
      isError: true,
    };
  }
  return null;
}

export default function AuthForm({
  page,
  content,
  authRoot,
  authTarget,
  query,
  locale,
  termsVersion,
  signupReady,
}: {
  page: AuthPageName;
  content: AuthContent;
  authRoot: string;
  authTarget: string;
  query: AuthQuery;
  locale: Locale;
  termsVersion: string;
  signupReady: boolean;
}) {
  const t=(key:string)=>authText(locale,key);
  const [status, setStatus] = useState<Status>(() => initialStatus(page, query));
  const [pending, setPending] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(query.email ?? null);

  // The sign-up flow stores the address for the verification screen.
  useEffect(() => {
    if (page !== "verify-email") return;
    const stored = sessionStorage.getItem("cmsmotive:verification-email");
    if (stored) setVerifyEmail(stored);
  }, [page]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") || "");
    const confirmation = String(fields.get("confirm_password") || "");
    if (confirmation && confirmation !== password) {
      setStatus({ message: "Passwords do not match.", isError: true });
      return;
    }
    setPending(true);
    setStatus(null);
    let redirecting = false;
    try {
      if (page === "sign-up") {
        const email = String(fields.get("email") || "").trim();
        await authPost("sign-up/email", {
          name: String(fields.get("name") || "").trim(),
          email,
          password,
          callbackURL: authTarget,
          termsAccepted: fields.get("terms")==="on",
          acceptedTermsVersion: termsVersion,
          locale,
        });
        sessionStorage.setItem("cmsmotive:verification-email", email);
        window.location.assign(`/auth/verify-email?lang=${locale}&email=${encodeURIComponent(email)}${query.next?`&next=${encodeURIComponent(query.next)}`:""}`);
        redirecting = true;
      } else if (page === "sign-in") {
        await authPost("sign-in/email", {
          email: String(fields.get("email") || "").trim(),
          password,
          rememberMe: fields.get("remember") === "on",
          callbackURL: authTarget,
        });
        const destination = await fetch("/api/auth-target", { credentials: "same-origin", cache: "no-store" });
        if (!destination.ok) throw new Error("Your session could not be checked. Please try again.");
        const account = await destination.json();
        queueAccountNotice("signed-in");
        window.location.assign(query.next || account.target==="/account"?authTarget:account.target||authTarget);
        redirecting = true;
      } else if (page === "forgot-password") {
        await authPost("request-password-reset", {
          email: String(fields.get("email") || "").trim(),
          redirectTo: `${window.location.origin}${authRoot}/reset-password?lang=${locale}`,
        });
        setStatus({ message: "If an account exists for that address, a reset link is on its way.", isError: false });
      } else if (page === "reset-password") {
        const token = query.token;
        if (!token) throw new Error("Open the link in your reset email first.");
        await authPost("reset-password", { newPassword: password, token });
        window.location.assign(`${authRoot}/sign-in?reset=success&lang=${locale}`);
        redirecting = true;
      } else {
        const email = query.email || sessionStorage.getItem("cmsmotive:verification-email");
        if (!email) throw new Error("Enter your email from the sign-up page first.");
        await authPost("send-verification-email", { email, callbackURL: authTarget });
        setStatus({ message: "A new verification link has been sent.", isError: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      if (page === "sign-in") showAccountToast(message);
      else setStatus({ message, isError: true });
    } finally {
      if (!redirecting) setPending(false);
    }
  }

  const isVerify = page === "verify-email";

  return (
    <>
      {isVerify && (
        <>
          <div className="auth-verify-copy">
            <h2>{t(verifyEmail?"Check your inbox":"Verify your address")}</h2>
            <p>
              {verifyEmail
                ? authText(locale,"If a verification message was requested, check {email}. You can request another message below.",{email:verifyEmail})
                : t("Open the confirmation link in your email. If you need another message, return to sign in and enter your email.")}
            </p>
          </div>
        </>
      )}
      <form className={isVerify ? "auth-form auth-resend-form" : "auth-form"} onSubmit={handleSubmit} aria-busy={pending}>
        {content.fields.map((field) => (
          <Field key={field.name} field={field} locale={locale} />
        ))}
        {content.formHelp && <p className="auth-form-help">{content.formHelp}</p>}
        {page === "sign-in" && (
          <div className="auth-form-row">
            <label className="auth-check">
              <input type="checkbox" name="remember" />
              <span>{t("Remember me")}</span>
            </label>
            <a href={`${authRoot}/forgot-password?lang=${locale}`}>{t("Forgot your password?")}</a>
          </div>
        )}
        {content.terms && (
          <label className="auth-check auth-terms">
            <input type="checkbox" name="terms" required />
            <span>
              {t("I accept the account terms.")} <a href={localizePath("/terms",locale)}>{t("Terms")}</a>
            </span>
          </label>
        )}
        {content.terms && <p className="auth-form-help"><a href={localizePath("/privacy",locale)}>{t("Read how we process your data in the privacy policy.")}</a> · {termsVersion}</p>}
        {page==="sign-up"&&!signupReady&&<p role="status">{copy(locale,"Registration is unavailable while provider information is being completed.","Die Registrierung ist bis zur Vervollständigung der Anbieterangaben nicht verfügbar.","Sağlayıcı bilgileri tamamlanana kadar kayıt açık değildir.")}</p>}
        <button className="auth-submit" type="submit" disabled={pending || (page==="sign-up"&&!signupReady) || (isVerify&&!verifyEmail) || (page==="reset-password"&&!query.token)}>
          {pending && <svg className="auth-submit-spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="32 12" /></svg>}
          <span>{pending ? t(PENDING_LABELS[page]) : content.submitLabel}</span>
        </button>
        <p
          className="auth-form-status"
          role="status"
          aria-live="polite"
          hidden={!status}
          data-error={status?.isError ?? false}
        >
          {status?t(status.message):null}
        </p>
      </form>
    </>
  );
}

function Field({ field, locale }: { field: AuthField; locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const id = `auth-${field.name}`;
  const type = field.type === "password" && visible ? "text" : field.type;
  return (
    <div className="auth-field">
      <label htmlFor={id}>{field.label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          name={field.name}
          type={type}
          placeholder={field.placeholder}
          autoComplete={field.autocomplete}
          required
          minLength={field.minLength}
          className={field.type === "password" ? "auth-input-password" : undefined}
          aria-describedby={field.hint ? `${id}-hint` : undefined}
        />
        {field.type === "password" && (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setVisible((value) => !value)}
            aria-label={authText(locale,visible?"Hide password":"Show password")}
            aria-controls={id}
            aria-pressed={visible}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {visible ? <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.5 5.3A12 12 0 0 1 12 5c5.5 0 9 7 9 7a17 17 0 0 1-3.1 4.1M6.2 6.2A19 19 0 0 0 3 12s3.5 7 9 7a11 11 0 0 0 5.1-1.3" /> : <><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" /><circle cx="12" cy="12" r="2.5" /></>}
            </svg>
          </button>
        )}
      </div>
      {field.hint && <p id={`${id}-hint`} className="auth-field-hint">{field.hint}</p>}
    </div>
  );
}
