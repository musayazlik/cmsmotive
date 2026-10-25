"use client";

import { useState, type FormEvent } from "react";
import { copy } from "@/lib/legal-copy";
import { localizePath, type Locale } from "@/lib/i18n/config";
import "./product-checkout.css";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  installations: number;
};
export default function ProductCheckoutForm({
  plans,
  locale: l,
  termsVersion,
  ready,
  testMode,
  returnPath,
  initialPlanId,
}: {
  plans: Plan[];
  locale: Locale;
  termsVersion: string;
  ready: boolean;
  testMode: boolean;
  returnPath: string;
  initialPlanId?: string;
}) {
  const [planId, setPlanId] = useState(
    plans.find((p) => p.id === initialPlanId)?.id ?? plans[0]?.id ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  const annualPrice = new Intl.NumberFormat(
    l === "tr" ? "tr-TR" : l === "de" ? "de-DE" : "en-IE",
    { style: "currency", currency: "EUR" },
  ).format(plan.priceCents / 100);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    let redirecting = false;
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 && result.loginUrl) {
        window.location.assign(result.loginUrl);
        redirecting = true;
        return;
      }
      if (!response.ok) {
        if (result.code === "EMAIL_UNVERIFIED")
          throw new Error(
            copy(
              l,
              "Verify your email before paying. Use the confirmation link sent to your inbox.",
              "Bestätigen Sie vor der Zahlung Ihre E-Mail über den Link in Ihrem Posteingang.",
              "Ödemeden önce gelen kutunuzdaki doğrulama bağlantısıyla e-postanızı doğrulayın.",
            ),
          );
        if (response.status === 429)
          throw new Error(
            copy(
              l,
              "Please wait a minute before trying again.",
              "Bitte warten Sie eine Minute und versuchen Sie es erneut.",
              "Yeniden denemeden önce bir dakika bekleyin.",
            ),
          );
        if (response.status === 400)
          throw new Error(
            copy(
              l,
              "The terms have changed. Refresh this page and accept the current terms.",
              "Die Bedingungen wurden geändert. Laden Sie die Seite neu und akzeptieren Sie die aktuellen Bedingungen.",
              "Koşullar değişmiş olabilir. Sayfayı yenileyip güncel koşulları kabul edin.",
            ),
          );
        throw new Error(
          copy(
            l,
            "Payment could not be opened. Please try again or contact support.",
            "Die Zahlung konnte nicht geöffnet werden. Versuchen Sie es erneut oder kontaktieren Sie den Support.",
            "Ödeme sayfası açılamadı. Yeniden deneyin veya destek ile iletişime geçin.",
          ),
        );
      }
      if (typeof result.url !== "string")
        throw new Error(
          copy(
            l,
            "Payment could not be opened. Please try again.",
            "Die Zahlung konnte nicht geöffnet werden. Bitte erneut versuchen.",
            "Ödeme sayfası açılamadı. Lütfen yeniden deneyin.",
          ),
        );
      window.location.assign(result.url);
      redirecting = true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : copy(
              l,
              "Connection failed. Please try again.",
              "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
              "Bağlantı kurulamadı. Lütfen yeniden deneyin.",
            ),
      );
    } finally {
      if (!redirecting) setPending(false);
    }
  }
  return (
    <form
      className="product-checkout"
      onSubmit={submit}
      action="/api/billing/checkout"
      method="post"
      aria-busy={pending}
    >
      <input type="hidden" name="termsVersion" value={termsVersion} />
      <input type="hidden" name="lang" value={l} />
      <input
        type="hidden"
        name="returnPath"
        value={`${returnPath}?${new URLSearchParams({ plan: planId, lang: l })}`}
      />
      <div className="buy-price">
        <small>
          {testMode
            ? copy(l, "Test subscription", "Testabonnement", "Test aboneliği")
            : copy(
                l,
                "Annual subscription",
                "Jährliches Abonnement",
                "Yıllık abonelik",
              )}
        </small>
        <strong>{annualPrice}</strong>
        <small>
          {copy(
            l,
            "/ year, tax included",
            "/ Jahr, inkl. Steuern",
            "/ yıl, vergiler dahil",
          )}
        </small>
      </div>
      <label className="control-caption" htmlFor="purchase-plan">
        {copy(l, "Service plan", "Servicepaket", "Hizmet paketi")}
      </label>
      <select
        id="purchase-plan"
        name="planId"
        value={planId}
        onChange={(e) => setPlanId(e.target.value)}
        disabled={pending}
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · €{(p.priceCents / 100).toFixed(2)}
            {copy(l, " / year", " / Jahr", " / yıl")}
          </option>
        ))}
      </select>
      {testMode && (
        <p className="purchase-test-note">
          {copy(
            l,
            "Creem test payment. No real charge; this sample does not include a released theme package.",
            "Creem-Testzahlung. Keine echte Belastung; dieses Muster enthält kein veröffentlichtes Theme-Paket.",
            "Creem test ödemesi. Gerçek tahsilat yapılmaz; bu örnekte kullanıma hazır tema paketi bulunmaz.",
          )}
        </p>
      )}
      <p className="purchase-disclosure">
        {copy(
          l,
          "12 months of updates and support. Automatically renews at the annual price shown until cancelled.",
          "12 Monate Updates und Support. Automatische jährliche Verlängerung zum angezeigten Preis bis zur Kündigung.",
          "12 ay güncelleme ve destek. İptal edilene kadar gösterilen yıllık ücretle otomatik yenilenir.",
        )}{" "}
        {copy(
          l,
          "Supported installations:",
          "Betreute Installationen:",
          "Destek kapsamındaki kurulum:",
        )}{" "}
        {plan.installations}.
      </p>
      <label className="purchase-consent">
        <input type="checkbox" name="terms" required disabled={pending} />
        <span>
          {copy(l, "I accept the", "Ich akzeptiere die", "Kabul ediyorum:")}{" "}
          <a
            href={localizePath("/terms", l)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy(l, "sales terms", "Verkaufsbedingungen", "satış koşulları")}
          </a>
          .
        </span>
      </label>
      <label className="purchase-consent">
        <input type="checkbox" name="renewal" required disabled={pending} />
        <span>
          {copy(
            l,
            `I authorize ${annualPrice} now and each year until cancellation.`,
            `Ich stimme ${annualPrice} jetzt und jährlich bis zur Kündigung zu.`,
            `Şimdi ve iptal edene kadar her yıl ${annualPrice} tahsilatını onaylıyorum.`,
          )}
        </span>
      </label>
      {!ready && (
        <p className="purchase-error" role="status">
          {copy(
            l,
            "Payments are not available for this product yet.",
            "Zahlungen sind für dieses Produkt noch nicht verfügbar.",
            "Bu ürün için ödemeler henüz açık değil.",
          )}
        </p>
      )}
      {error && (
        <p className="purchase-error" role="alert">
          {error}{" "}
          <a href={localizePath("/contact", l)}>
            {copy(l, "Contact support", "Support kontaktieren", "Destek alın")}
          </a>
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={!ready || pending}
        type="submit"
      >
        <span>
          {pending
            ? copy(
                l,
                "Opening secure checkout…",
                "Sichere Zahlung wird geöffnet…",
                "Güvenli ödeme açılıyor…",
              )
            : testMode
              ? copy(
                  l,
                  "Pay with Creem — test",
                  "Mit Creem bezahlen — Test",
                  "Creem ile öde — test",
                )
              : copy(
                  l,
                  "Pay with Creem",
                  "Mit Creem bezahlen",
                  "Creem ile öde",
                )}
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      <p className="purchase-secure-note">
        {copy(
          l,
          "Secure checkout by Creem. Sign in if prompted; you will return to this product. Manage cancellation in your account.",
          "Sichere Zahlung über Creem. Nach einer nötigen Anmeldung kehren Sie zu diesem Produkt zurück. Kündigungen verwalten Sie im Konto.",
          "Güvenli ödeme Creem üzerinden yapılır. Gerekirse girişten sonra bu ürüne dönersiniz. İptali hesabınızdan yönetebilirsiniz.",
        )}{" "}
        <a href={localizePath("/privacy", l)}>
          {copy(l, "Privacy", "Datenschutz", "Gizlilik")}
        </a>
      </p>
    </form>
  );
}
