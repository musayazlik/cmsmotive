"use client";

import { useState, useTransition } from "react";
import { switchPanelStore } from "../_store-actions";
import Select from "./ui/select";

export type PanelStoreOption = { id: string; name: string };

/** A store switch opens that store's own domain and starts at its panel overview. */
export default function StoreSwitcher({ stores, current }: { stores: PanelStoreOption[]; current: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (stores.length < 2) return null;

  return (
    <div className="workspace-store-switcher" aria-busy={pending}>
      <Select
        label="Store"
        hideLabel
        value={current}
        disabled={pending}
        error={error}
        options={stores.map((store) => ({ value: store.id, label: store.name }))}
        onChange={(storeId) => {
          if (storeId === current) return;
          setError("");
          startTransition(async () => {
            try {
              const result = await switchPanelStore(storeId);
              if (!result.ok) { setError(result.error); return; }
              const form = document.createElement("form");
              form.method = "POST";
              form.action = result.href;
              form.hidden = true;
              const token = document.createElement("input");
              token.type = "hidden";
              token.name = "token";
              token.value = result.token;
              form.append(token);
              document.body.append(form);
              form.submit();
            } catch {
              setError("Could not switch stores. Try again.");
            }
          });
        }}
      />
    </div>
  );
}
