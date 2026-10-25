"use client";

import { useState, type FormEvent } from "react";
import { copy } from "@/lib/legal-copy";
import { LOCALE_TAGS, localizePath, type Locale } from "@/lib/i18n/config";
import { formatAmount } from "@/lib/prices";
import type { PublicPrice } from "@/lib/product-page";
import "./product-checkout.css";

/** "year", "Jahr", "yıl" … for a renewal interval. */
function per(l: Locale, interval: string | null): string {
  switch (interval) {
    case "month":
      return copy(l, "month", "Monat", "ay");
    case "quarter":
      return copy(l, "3 months", "3 Monate", "3 ay");
    case "half-year":
      return copy(l, "6 months", "6 Monate", "6 ay");
    default:
      return copy(l, "year", "Jahr", "yıl");
  }
}

/** "every year", "jedes Jahr", "her yıl" … */
function every(l: Locale, interval: string | null): string {
  switch (interval) {
    case "month":
      return copy(l, "every month", "jeden Monat", "her ay");
    case "quarter":
      return copy(l, "every 3 months", "alle 3 Monate", "her 3 ayda bir");
    case "half-year":
      return copy(l, "every 6 months", "alle 6 Monate", "her 6 ayda bir");
    default:
      return copy(l, "every year", "jedes Jahr", "her yıl");
  }
}

/** The buy box: price picker, disclosures, consent and the redirect to Creem; one-time and subscription prices alike. */
export default function ProductCheckoutForm({
  prices,
  locale: l,
  termsVersion,
  ready,
  testMode,
  returnPath,
  initialPriceId,
}: {
  prices: PublicPrice[];
  locale: Locale;
  termsVersion: string;
  ready: boolean;
  testMode: boolean;
  returnPath: string;
  initialPriceId?: string;
}) {
  const [priceId, setPriceId] = useState(
    prices.find((p) => p.id === initialPriceId)?.id ?? prices[0]?.id ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const price = prices.find((p) => p.id === priceId);
  if (!price) return null;
  const recurring = price.billingType === "recurring";
  const tag = LOCALE_TAGS[l];
  const amount = formatAmount(price.amountCents, price.currency, tag);
  const taxNote =
    price.taxMode === "inclusive"
      ? copy(l, "tax included", "inkl. Steuern", "vergiler dahil")
      : copy(l, "plus applicable tax", "zzgl. Steuern", "vergiler hariç");
  const label = (p: PublicPrice) =>
    `${p.name} · ${formatAmount(p.amountCents, p.currency, tag)}${p.billingType === "recurring" ? ` / ${per(l, p.interval)}` : ""}`;
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
        value={`${returnPath}?${new URLSearchParams({ price: priceId, lang: l })}`}
      />
      <div className="buy-price">
        <small>
          {testMode
            ? recurring
              ? copy(l, "Test subscription", "Testabonnement", "Test aboneliği")
              : copy(l, "Test purchase", "Testkauf", "Test satın alma")
            : recurring
              ? copy(l, "Subscription", "Abonnement", "Abonelik")
              : copy(l, "One-time purchase", "Einmalkauf", "Tek seferlik satın alma")}
        </small>
        <strong>{amount}</strong>
        <small>{recurring ? `/ ${per(l, price.interval)}, ${taxNote}` : taxNote}</small>
      </div>
      {prices.length > 1 ? (
        <>
          <label className="control-caption" htmlFor="purchase-price">
            {copy(l, "Choose an option", "Option wählen", "Seçenek belirleyin")}
          </label>
          <select
            id="purchase-price"
            name="priceId"
            value={priceId}
            onChange={(e) => setPriceId(e.target.value)}
            disabled={pending}
          >
            {prices.map((p) => (
              <option key={p.id} value={p.id}>
                {label(p)}
              </option>
            ))}
          </select>
        </>
      ) : (
        <input type="hidden" name="priceId" value={priceId} />
      )}
      {price.features.length > 0 && (
        <ul className="purchase-features">
          {price.features.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {testMode && (
        <p className="purchase-test-note">
          {copy(
            l,
            "Creem test payment. No real charge; a test purchase does not include a released package.",
            "Creem-Testzahlung. Keine echte Belastung; ein Testkauf enthält kein veröffentlichtes Paket.",
            "Creem test ödemesi. Gerçek tahsilat yapılmaz; test satın alması kullanıma hazır paket içermez.",
          )}
        </p>
      )}
      <p className="purchase-disclosure">
        {recurring
          ? copy(
              l,
              `Updates and support while subscribed. Renews automatically at ${amount} ${every(l, price.interval)} until cancelled.`,
              `Updates und Support während des Abonnements. Verlängert sich automatisch zu ${amount} ${every(l, price.interval)} bis zur Kündigung.`,
              `Abonelik süresince güncelleme ve destek. İptal edilene kadar ${every(l, price.interval)} ${amount} ile otomatik yenilenir.`,
            )
          : price.updatesMonths
            ? copy(
                l,
                `One payment. Includes ${price.updatesMonths} months of updates; versions released in that time stay yours.`,
                `Einmalige Zahlung. Enthält ${price.updatesMonths} Monate Updates; in dieser Zeit erschienene Versionen bleiben Ihre.`,
                `Tek ödeme. ${price.updatesMonths} ay güncelleme içerir; bu sürede çıkan sürümler sizde kalır.`,
              )
            : copy(
                l,
                "One payment. Includes lifetime updates.",
                "Einmalige Zahlung. Enthält lebenslange Updates.",
                "Tek ödeme. Ömür boyu güncelleme içerir.",
              )}{" "}
        {copy(
          l,
          "Supported installations:",
          "Betreute Installationen:",
          "Destek kapsamındaki kurulum:",
        )}{" "}
        {price.seats}.
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
      {recurring && (
        <label className="purchase-consent">
          <input type="checkbox" name="renewal" required disabled={pending} />
          <span>
            {copy(
              l,
              `I authorize ${amount} now and ${every(l, price.interval)} until cancellation.`,
              `Ich stimme ${amount} jetzt und ${every(l, price.interval)} bis zur Kündigung zu.`,
              `Şimdi ve iptal edene kadar ${every(l, price.interval)} ${amount} tahsilatını onaylıyorum.`,
            )}
          </span>
        </label>
      )}
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
          "Secure checkout by Creem. Sign in if prompted; you will return to this product. Downloads, invoices and cancellation are in your account.",
          "Sichere Zahlung über Creem. Nach einer nötigen Anmeldung kehren Sie zu diesem Produkt zurück. Downloads, Rechnungen und Kündigung finden Sie im Konto.",
          "Güvenli ödeme Creem üzerinden yapılır. Gerekirse girişten sonra bu ürüne dönersiniz. İndirmeler, faturalar ve iptal hesabınızdadır.",
        )}{" "}
        <a href={localizePath("/privacy", l)}>
          {copy(l, "Privacy", "Datenschutz", "Gizlilik")}
        </a>
      </p>
    </form>
  );
}
