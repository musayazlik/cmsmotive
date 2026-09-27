"use client";

import { useState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";

const MIN_LENGTH = 8;

export default function AccountForm() {
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
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        placeholder="••••••••"
        disabled={pending}
      />
      <div className="winbox-password-row">
        <TextField
          id="w-account-new"
          label="New password"
          hint={`min. ${MIN_LENGTH} characters`}
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="••••••••"
          disabled={pending}
        />
        <TextField
          id="w-account-confirm"
          label="Repeat new password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="••••••••"
          disabled={pending}
        />
      </div>
      <p className="wfield-hint-block">
        Changing the password signs out your other devices; this session stays active.
      </p>

      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {saved ? "Password updated." : ""}
        </span>
        <button
          type="button"
          className="wbtn wbtn-primary"
          onClick={changePassword}
          disabled={pending || !currentPassword || !newPassword || !confirmPassword}
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}
