"use client";

import { useState } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import TextField from "@/app/panel/_components/ui/text-field";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

export default function AccountNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const trimmedName = name.trim();
  const dirty = trimmedName !== initialName.trim();

  function changeName(value: string) {
    setSaved(false);
    setName(value);
  }

  async function updateName() {
    setError("");
    setSaved(false);
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      setError(`Your name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`);
      return;
    }
    if (!dirty) return;

    setPending(true);
    try {
      const response = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? "Your name could not be updated.");
        return;
      }
      setName(trimmedName);
      setSaved(true);
      // Refresh the server-rendered panel so the header shows the new name.
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wform">
      <TextField
        id="w-account-name"
        label="Name"
        value={name}
        onChange={changeName}
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        required
        disabled={pending}
      />

      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {saved ? "Name updated." : ""}
        </span>
        <button
          type="button"
          className="wbtn wbtn-primary"
          onClick={updateName}
          disabled={pending || !dirty || trimmedName.length < MIN_NAME_LENGTH}
        >
          {pending ? "Updating…" : "Update name"}
        </button>
      </div>
    </div>
  );
}
