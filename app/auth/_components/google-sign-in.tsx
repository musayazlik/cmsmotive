"use client";
import { useState, type FormEvent } from "react";
import { copy } from "@/lib/legal-copy";
import { localizePath, type Locale } from "@/lib/i18n/config";

export default function GoogleSignIn({
  locale: l,
  enabled,
  termsVersion,
  callbackURL,
  errorURL,
}: {
  locale: Locale;
  enabled: boolean;
  termsVersion: string;
  callbackURL: string;
  errorURL: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL,
          errorCallbackURL: errorURL,
          disableRedirect: true,
          additionalData: {
            termsAccepted: form.get("google-terms") === "on",
            acceptedTermsVersion: termsVersion,
            locale: l,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== "string")
        throw Error(
          copy(
            l,
            "Google sign-in could not be started. Try again or sign in with email.",
            "Google-Anmeldung konnte nicht gestartet werden. Versuchen Sie es erneut oder melden Sie sich per E-Mail an.",
            "Google ile giriş başlatılamadı. Yeniden deneyin veya e-posta ile giriş yapın.",
          ),
        );
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw Error(
          copy(
            l,
            "Unexpected sign-in destination.",
            "Unerwartetes Anmeldeziel.",
            "Beklenmeyen giriş adresi.",
          ),
        );
      window.location.assign(url.href);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : copy(
              l,
              "Try again.",
              "Bitte erneut versuchen.",
              "Lütfen yeniden deneyin.",
            ),
      );
      setPending(false);
    }
  }
  return (
    <div className="auth-social">
      <div className="auth-social-divider">
        <span>{copy(l, "or", "oder", "veya")}</span>
      </div>
      <form onSubmit={submit} aria-busy={pending}>
        <label className="auth-google-consent">
          <input
            name="google-terms"
            type="checkbox"
            required
            disabled={!enabled || pending}
          />
          <span>
            {copy(l, "I accept the", "Ich akzeptiere die", "Kabul ediyorum:")}{" "}
            <a href={localizePath("/terms", l)}>
              {copy(l, "account terms", "Kontobedingungen", "hesap koşulları")}
            </a>
            .{" "}
            <a href={localizePath("/privacy", l)}>
              {copy(
                l,
                "Privacy policy",
                "Datenschutzerklärung",
                "Gizlilik politikası",
              )}
            </a>
          </span>
        </label>
        <button
          className="auth-google-button"
          type="submit"
          disabled={!enabled || pending}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 13.92A6 6 0 0 1 6.09 12c0-.67.11-1.32.31-1.92V7.49H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.51l3.34-2.59Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
            />
          </svg>
          {pending
            ? copy(
                l,
                "Connecting to Google…",
                "Verbindung zu Google…",
                "Google'a bağlanılıyor…",
              )
            : copy(
                l,
                "Continue with Google",
                "Mit Google fortfahren",
                "Google ile devam et",
              )}
        </button>
        {!enabled && (
          <p className="auth-field-hint">
            {copy(
              l,
              "Google sign-in is not available yet. Use your email address.",
              "Google-Anmeldung ist noch nicht verfügbar. Verwenden Sie Ihre E-Mail-Adresse.",
              "Google ile giriş henüz kullanılamıyor. E-posta adresinizi kullanabilirsiniz.",
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="auth-form-status is-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
