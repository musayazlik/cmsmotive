"use client";

import { useState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import { authText } from "@/lib/auth-copy";
import type { Locale } from "@/lib/i18n/config";

const MIN_LENGTH = 8;

export default function AccountForm({ locale = "en" }: { locale?: Locale }) {
  const t = (key: string) => authText(locale, key);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function changePassword() {
    setError("");
    setSaved(false);
    if (newPassword.length < MIN_LENGTH) {
      setError(`The new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("The new password must be different from the current one.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 401) {
          setError("The current password is incorrect.");
        } else {
          setError(payload?.message ?? "The password could not be changed.");
        }
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wform">
      <TextField
        id="w-account-current"
        label={t("Current password")}
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        placeholder="••••••••"
        disabled={pending}
      />
      <TextField
        id="w-account-new"
        label={t("New password")}
        hint={t("Use at least 8 characters.")}
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        placeholder="••••••••"
        disabled={pending}
      />
      <TextField
        id="w-account-confirm"
        label={t("Repeat new password")}
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        placeholder="••••••••"
        disabled={pending}
      />
      <p className="wfield-hint-block">
        {t("Changing the password signs out your other devices; this session stays active.")}
      </p>

      {error ? (
        <p className="wdialog-error" role="alert">
          {t(error)}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {saved ? t("Password updated.") : ""}
        </span>
        <button
          type="button"
          className="wbtn wbtn-primary"
          onClick={changePassword}
          disabled={pending || !currentPassword || !newPassword || !confirmPassword}
        >
          {pending ? t("Updating…") : t("Update password")}
        </button>
      </div>
    </div>
  );
}
