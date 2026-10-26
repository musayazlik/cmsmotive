"use client";

import { useActionState, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { changePlanAction, type PlanState } from "./_actions";

const idle: PlanState = { status: "idle", message: "" };

export type PlanOption = { id: string; name: string; price: string; seats: string; features: string[] };

export default function PlanForm({ subscriptionId, options, locale: l }: { subscriptionId: string; options: PlanOption[]; locale: Locale }) {
  const [state, submit, pending] = useActionState(changePlanAction, idle);
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form className="wform" action={submit}>
      <input type="hidden" name="subscription" value={subscriptionId} />
      <div className="customer-plans" role="radiogroup" aria-label={copy(l, "New plan", "Neuer Tarif", "Yeni plan")}>
        {options.map((option) => (
          <label key={option.id} className="customer-plan" data-selected={selected === option.id}>
            <input type="radio" name="price" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} disabled={pending} />
            <span>
              <strong>{option.name}</strong>
              <em>{option.price}</em>
              <small>{option.seats}</small>
              {option.features.length > 0 && (
                <ul>
                  {option.features.slice(0, 4).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
            </span>
          </label>
        ))}
      </div>
      <label className="customer-check">
        <input type="checkbox" name="confirm" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} />
        <span>
          {copy(
            l,
            "I agree that the prorated difference for the rest of the current period is charged now to my saved payment method, and the new price applies from the next renewal.",
            "Ich bin einverstanden, dass die anteilige Differenz für den Rest des laufenden Zeitraums jetzt von meiner hinterlegten Zahlungsmethode abgebucht wird und ab der nächsten Verlängerung der neue Preis gilt.",
            "Mevcut dönemin kalanı için orantılı farkın şimdi kayıtlı ödeme yöntemimden tahsil edilmesini ve sonraki yenilemeden itibaren yeni fiyatın uygulanmasını kabul ediyorum.",
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
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || !selected || !confirmed}>
          {pending ? copy(l, "Changing…", "Wird geändert…", "Değiştiriliyor…") : copy(l, "Change plan", "Tarif wechseln", "Planı değiştir")}
        </button>
      </div>
    </form>
  );
}
