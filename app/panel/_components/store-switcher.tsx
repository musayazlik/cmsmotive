"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchPanelStore } from "../_store-actions";
import Select from "./ui/select";

export type PanelStoreOption = { id: string; name: string };

/** Picks the store every panel page edits; the server keeps the choice in a cookie. */
export default function StoreSwitcher({ stores, current }: { stores: PanelStoreOption[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (stores.length < 2) return null;

  return (
    <div className="workspace-store-switcher" aria-busy={pending}>
      <Select
        label="Store"
        hideLabel
        value={current}
        disabled={pending}
        options={stores.map((store) => ({ value: store.id, label: store.name }))}
        onChange={(storeId) => {
          if (storeId === current) return;
          startTransition(async () => {
            const result = await switchPanelStore(storeId);
            if (result.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
