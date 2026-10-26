"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import TextField from "@/app/panel/_components/ui/text-field";
import TextArea from "@/app/panel/_components/ui/text-area";
import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { createTicketAction, replyTicketAction, type SupportState } from "./_actions";

const idle: SupportState = { status: "idle", message: "" };

function FormError({ state }: { state: SupportState }) {
  return state.status === "error" ? (
    <p className="wdialog-error" role="alert">
      {state.message}
    </p>
  ) : null;
}

export function NewTicketForm({ products, locale: l }: { products: { id: string; name: string }[]; locale: Locale }) {
  const [state, submit, pending] = useActionState(createTicketAction, idle);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <form className="wform" action={submit}>
      {products.length > 0 && (
        <label className="customer-select-field">
          <span>
            <strong>{copy(l, "Product", "Produkt", "Ürün")}</strong>
          </span>
          <select name="productId" defaultValue="" disabled={pending}>
            <option value="">{copy(l, "General question", "Allgemeine Frage", "Genel soru")}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <TextField id="support-subject" name="subject" label={copy(l, "Subject", "Betreff", "Konu")} value={subject} onChange={setSubject} maxLength={120} disabled={pending} />
      <TextArea
        id="support-body"
        name="body"
        label={copy(l, "How can we help?", "Wie können wir helfen?", "Nasıl yardımcı olabiliriz?")}
        hint={copy(l, "Include your TYPO3 version, the site address and what you already tried.", "Nennen Sie Ihre TYPO3-Version, die Website-Adresse und was Sie bereits versucht haben.", "TYPO3 sürümünüzü, site adresini ve denediklerinizi yazın.")}
        value={body}
        onChange={setBody}
        rows={7}
        maxLength={5000}
        disabled={pending}
      />
      <FormError state={state} />
      <div className="wsettings-foot">
        <span />
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || subject.trim().length < 3 || body.trim().length < 10}>
          {pending ? copy(l, "Sending…", "Wird gesendet…", "Gönderiliyor…") : copy(l, "Send request", "Anfrage senden", "Talebi gönder")}
        </button>
      </div>
    </form>
  );
}

export function ReplyForm({ ticketId, closed, locale: l }: { ticketId: string; closed: boolean; locale: Locale }) {
  const [state, submit, pending] = useActionState(replyTicketAction.bind(null, ticketId), idle);
  const [body, setBody] = useState("");
  const wasPending = useRef(false);
  useEffect(() => {
    // Clear the box once a reply went through (the thread re-renders with it).
    if (wasPending.current && !pending && state.status === "idle") setBody("");
    wasPending.current = pending;
  }, [pending, state.status]);
  return (
    <form className="wform" action={submit}>
      <TextArea
        id="support-reply"
        name="body"
        label={closed ? copy(l, "Reopen with a new message", "Mit neuer Nachricht wieder öffnen", "Yeni bir mesajla yeniden aç") : copy(l, "Your reply", "Ihre Antwort", "Yanıtınız")}
        value={body}
        onChange={setBody}
        rows={5}
        maxLength={5000}
        disabled={pending}
      />
      <FormError state={state} />
      <div className="wsettings-foot">
        <span />
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || !body.trim()}>
          {pending ? copy(l, "Sending…", "Wird gesendet…", "Gönderiliyor…") : copy(l, "Send", "Senden", "Gönder")}
        </button>
      </div>
    </form>
  );
}
