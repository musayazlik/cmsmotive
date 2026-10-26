"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { deactivateInstanceAction } from "./_actions";

export type InstanceRow = { id: string; name: string; status: string; activatedAt: string };

export default function InstanceList({ licenseKeyId, instances, locale: l }: { licenseKeyId: string; instances: InstanceRow[]; locale: Locale }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const release = (instance: InstanceRow) => {
    if (!window.confirm(copy(l, `Release “${instance.name}”? That installation stops validating this key.`, `„${instance.name}“ freigeben? Diese Installation kann den Schlüssel dann nicht mehr verwenden.`, `“${instance.name}” serbest bırakılsın mı? Bu kurulum artık anahtarı doğrulayamaz.`))) return;
    setFailed(false);
    startTransition(async () => setFailed(!(await deactivateInstanceAction(licenseKeyId, instance.id))));
  };
  return (
    <>
      {failed && (
        <p className="wdialog-error" role="alert">
          {copy(l, "The installation could not be released. Try again later.", "Die Installation konnte nicht freigegeben werden. Versuchen Sie es später erneut.", "Kurulum serbest bırakılamadı. Daha sonra tekrar deneyin.")}
        </p>
      )}
      <ul className="customer-records">
        {instances.map((instance) => (
          <li className="customer-record" key={instance.id}>
            <div>
              <strong>{instance.name}</strong>
              <p>
                {copy(l, "Activated", "Aktiviert", "Etkinleştirildi")} {instance.activatedAt}
              </p>
            </div>
            {instance.status === "active" ? (
              <button className="wbtn wbtn-ghost" type="button" disabled={pending} onClick={() => release(instance)}>
                {copy(l, "Release", "Freigeben", "Serbest bırak")}
              </button>
            ) : (
              <span className="customer-status">{copy(l, "Released", "Freigegeben", "Serbest")}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
