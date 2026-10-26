"use client";

import { useState } from "react";
import { useActionState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import TextArea from "@/app/panel/_components/ui/text-area";
import { saveProfileDetailsAction, type ProfileActionState } from "../_actions";
import { profileFieldMaxLengths } from "../_limits";

const initial: ProfileActionState = { status: "idle", message: "" };

export type ProfileDetailsLabels = {
  name: string;
  nameHint: string;
  bio: string;
  bioHint: string;
  save: string;
  saving: string;
};

export default function ProfileDetailsForm({
  name,
  bio,
  labels,
}: {
  name: string;
  bio: string;
  labels: ProfileDetailsLabels;
}) {
  const [state, submit, pending] = useActionState(saveProfileDetailsAction, initial);
  const [value, setValue] = useState({ name, bio });

  return (
    <form className="wform" action={submit}>
      <TextField
        id="profile-name"
        label={labels.name}
        hint={labels.nameHint}
        value={value.name}
        onChange={(name) => setValue((current) => ({ ...current, name }))}
        autoComplete="name"
        maxLength={profileFieldMaxLengths.name}
        disabled={pending}
      />
      <TextArea
        id="profile-bio"
        label={labels.bio}
        hint={labels.bioHint}
        value={value.bio}
        onChange={(bio) => setValue((current) => ({ ...current, bio }))}
        maxLength={profileFieldMaxLengths.bio}
        rows={3}
        disabled={pending}
      />

      {state.status === "error" && state.message ? (
        <p className="wdialog-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {state.status === "ok" ? state.message : ""}
        </span>
        <button
          type="submit"
          className="wbtn wbtn-primary"
          disabled={pending || !value.name.trim()}
        >
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}
