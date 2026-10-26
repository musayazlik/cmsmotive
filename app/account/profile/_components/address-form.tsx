"use client";

import { useState } from "react";
import { useActionState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import { saveAddressAction, type ProfileActionState } from "../_actions";
import { profileFieldMaxLengths } from "../_limits";

const initial: ProfileActionState = { status: "idle", message: "" };

export type AddressLabels = {
  phone: string;
  phoneHint: string;
  company: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  save: string;
  saving: string;
};

export default function AddressForm({
  values,
  labels,
}: {
  values: { phone: string; company: string; street: string; postalCode: string; city: string; country: string };
  labels: AddressLabels;
}) {
  const [state, submit, pending] = useActionState(saveAddressAction, initial);
  const [v, setV] = useState(values);
  const set = (key: keyof typeof v) => (value: string) => setV((current) => ({ ...current, [key]: value }));

  return (
    <form className="wform" action={submit}>
      <TextField
        id="profile-phone"
        label={labels.phone}
        hint={labels.phoneHint}
        type="tel"
        value={v.phone}
        onChange={set("phone")}
        autoComplete="tel"
        maxLength={profileFieldMaxLengths.phone}
        disabled={pending}
      />
      <div className="customer-profile-grid">
        <TextField
          id="profile-company"
          label={labels.company}
          value={v.company}
          onChange={set("company")}
          autoComplete="organization"
          maxLength={profileFieldMaxLengths.company}
          disabled={pending}
        />
        <TextField
          id="profile-country"
          label={labels.country}
          value={v.country}
          onChange={set("country")}
          autoComplete="country-name"
          maxLength={profileFieldMaxLengths.country}
          disabled={pending}
        />
      </div>
      <TextField
        id="profile-street"
        label={labels.street}
        value={v.street}
        onChange={set("street")}
        autoComplete="street-address"
        maxLength={profileFieldMaxLengths.street}
        disabled={pending}
      />
      <div className="customer-profile-grid">
        <TextField
          id="profile-postal"
          label={labels.postalCode}
          value={v.postalCode}
          onChange={set("postalCode")}
          autoComplete="postal-code"
          maxLength={profileFieldMaxLengths.postalCode}
          disabled={pending}
        />
        <TextField
          id="profile-city"
          label={labels.city}
          value={v.city}
          onChange={set("city")}
          autoComplete="address-level2"
          maxLength={profileFieldMaxLengths.city}
          disabled={pending}
        />
      </div>

      {state.status === "error" && state.message ? (
        <p className="wdialog-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="wsettings-foot">
        <span className="wsettings-state" role="status">
          {state.status === "ok" ? state.message : ""}
        </span>
        <button type="submit" className="wbtn wbtn-primary" disabled={pending}>
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}
