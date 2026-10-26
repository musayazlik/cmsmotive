"use client";

import { useActionState, useState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { deleteAccountAction, type DeleteState } from "../_actions";

const idle: DeleteState = { status: "idle", message: "" };

export default function DeleteAccountForm({ locale: l, hasPassword, email }: { locale: Locale; hasPassword: boolean; email: string }) {
  const [state, submit, pending] = useActionState(deleteAccountAction, idle);
  const [secret, setSecret] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form className="wform" action={submit}>
      {hasPassword ? (
        <TextField id="delete-password" name="password" type="password" label={copy(l, "Current password", "Aktuelles Passwort", "Mevcut şifre")} value={secret} onChange={setSecret} autoComplete="current-password" disabled={pending} />
      ) : (
        <TextField id="delete-email" name="email" type="email" label={copy(l, `Type ${email} to confirm`, `Zur Bestätigung ${email} eingeben`, `Onaylamak için ${email} yazın`)} value={secret} onChange={setSecret} autoComplete="off" disabled={pending} />
      )}
      <label className="customer-check">
        <input type="checkbox" name="confirm" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} />
        <span>
          {copy(
            l,
            "I understand that my account, downloads and licence access are deleted permanently.",
            "Mir ist bewusst, dass mein Konto, meine Downloads und der Lizenzzugang endgültig gelöscht werden.",
            "Hesabımın, indirmelerimin ve lisans erişimimin kalıcı olarak silineceğini anlıyorum.",
          )}
        </span>
      </label>
      {state.status === "error" && (
        <p className="wdialog-error" role="alert">
          {state.message}
        </p>
      )}
      <div className="wsettings-foot">
        <span />
        <button className="wbtn wbtn-danger" type="submit" disabled={pending || !secret || !confirmed}>
          {pending ? copy(l, "Deleting…", "Wird gelöscht…", "Siliniyor…") : copy(l, "Delete my account", "Mein Konto löschen", "Hesabımı sil")}
        </button>
      </div>
    </form>
  );
}
