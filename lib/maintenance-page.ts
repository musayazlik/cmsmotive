import type { Locale } from "@/lib/i18n/config";
import { LEGAL_VERSION } from "./legal-settings-shared";
import { copy as localCopy } from "./legal-copy";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  DEFAULT_MAINTENANCE_TITLE,
  type MaintenanceSettings,
} from "@/lib/maintenance-settings-shared";

const COPY = {
  en: {
    title: "We’ll be right back.",
    message: "We’re making a few improvements to CMSMotive. A few finishing touches, and we’ll be ready to welcome you back.",
    state: "A little maintenance, a better CMSMotive",
    signup: "Be the first to know when we’re back.",
    email: "Your email address",
    placeholder: "you@example.com",
    submit: "Notify me",
    loading: "Saving…",
    subscribed: "You’re on the list",
    success: "You’re all set. We’ll let you know when CMSMotive is back online.",
    error: "We couldn’t save your email. Please try again.",
    invalidEmail: "Enter a valid email address.",
    note: "We’ll only use your email to let you know when we’re back.",
    art: "A few finishing touches",
    contact: "Need something in the meantime?",
    skip: "Skip to content",
    noscript: "Please enable JavaScript to sign up for a notification.",
  },
  de: {
    title: "Wir sind bald wieder da.",
    message: "Wir machen CMSMotive noch ein bisschen besser. Nur noch ein paar letzte Handgriffe, dann sind wir wieder für Sie da.",
    state: "Eine kleine Pause für ein besseres CMSMotive",
    signup: "Erfahren Sie zuerst, wenn wir zurück sind.",
    email: "Ihre E-Mail-Adresse",
    placeholder: "sie@beispiel.de",
    submit: "Benachrichtigen",
    loading: "Wird gespeichert…",
    subscribed: "Sie sind auf der Liste",
    success: "Ihre E-Mail-Adresse ist gespeichert. Wir melden uns, sobald CMSMotive wieder online ist.",
    error: "Ihre E-Mail-Adresse konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    note: "Wir nutzen Ihre E-Mail-Adresse nur, um Sie über unsere Rückkehr zu informieren.",
    art: "Die letzten Handgriffe",
    contact: "Sie brauchen uns in der Zwischenzeit?",
    skip: "Zum Inhalt springen",
    noscript: "Bitte aktivieren Sie JavaScript, um sich für eine Benachrichtigung anzumelden.",
  },
  tr: {
    title: "Çok yakında yeniden yayındayız.",
    message: "CMSMotive’i sizin için yeniliyoruz. Birkaç son dokunuşun ardından yeniden burada olacağız.",
    state: "Sitemiz bakımda",
    signup: "Yayına döndüğümüzde ilk siz öğrenin.",
    email: "E-posta adresiniz",
    placeholder: "siz@ornek.com",
    submit: "Bana haber ver",
    loading: "Kaydediliyor…",
    subscribed: "Kaydınız alındı",
    success: "E-posta adresiniz kaydedildi. CMSMotive yeniden yayına girdiğinde size haber vereceğiz.",
    error: "E-posta adresiniz kaydedilemedi. Lütfen tekrar deneyin.",
    invalidEmail: "Geçerli bir e-posta adresi girin.",
    note: "E-postanızı yalnızca yeniden yayına döndüğümüzü haber vermek için kullanacağız.",
    art: "Son dokunuşlar yapılıyor",
    contact: "Bu sırada bize ulaşmak isterseniz",
    skip: "İçeriğe geç",
    noscript: "Bildirim için kaydolmak üzere lütfen JavaScript’i etkinleştirin.",
  },
} satisfies Record<Locale, Record<string, string>>;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Standalone visitor page. Preview mode disables signup and automatic checks. */
export function maintenancePage(settings: MaintenanceSettings, locale: Locale = "en", { preview = false, privacyVersion = LEGAL_VERSION } = {}) {
  const copy = COPY[locale];
  const title = !settings.title || settings.title === DEFAULT_MAINTENANCE_TITLE ? copy.title : settings.title;
  const message = !settings.message || settings.message === DEFAULT_MAINTENANCE_MESSAGE ? copy.message : settings.message;
  const disabled = preview ? " disabled" : "";

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#f7f8f5" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="${escapeHtml(message)}" />
    <title>${escapeHtml(title)} · CMSMotive</title>
    <link rel="icon" type="image/png" href="/assets/icons/favicon.png" />
    <link rel="stylesheet" href="/assets/css/fonts.css" />
    <link rel="stylesheet" href="/assets/css/maintenance.css" />
    ${preview ? "" : '<script src="/assets/js/maintenance.js" defer></script>'}
  </head>
  <body class="maintenance-page">
    <a class="maintenance-skip" href="#main">${copy.skip}</a>
    <header class="maintenance-header maintenance-shell">
      <a class="maintenance-brand" href="/" aria-label="CMSMotive"><img src="/assets/images/logo.png" alt="CMSMotive" width="160" height="54" /></a>
    </header>
    <main id="main" class="maintenance-main maintenance-shell">
      <section class="maintenance-copy" aria-labelledby="maintenance-title">
        <p class="maintenance-state"><span aria-hidden="true"></span>${copy.state}</p>
        <h1 id="maintenance-title">${escapeHtml(title)}</h1>
        <p class="maintenance-message">${escapeHtml(message)}</p>
        <div class="maintenance-signup">
          <h2 id="signup-title">${copy.signup}</h2>
          <form data-maintenance-form action="/api/newsletter" method="post" aria-labelledby="signup-title"
            data-loading="${escapeHtml(copy.loading)}" data-subscribed="${escapeHtml(copy.subscribed)}"
            data-success="${escapeHtml(copy.success)}" data-error="${escapeHtml(copy.error)}"
            data-invalid-email="${escapeHtml(copy.invalidEmail)}">
            <label for="maintenance-email">${copy.email}</label>
            <div class="maintenance-fields">
              <input id="maintenance-email" name="email" type="email" placeholder="${copy.placeholder}" autocomplete="email" inputmode="email" maxlength="254" required aria-describedby="signup-note signup-status"${disabled} />
              <button type="submit"${disabled}>${copy.submit}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></button>
            </div>
            <input type="hidden" name="consentVersion" value="${escapeHtml(privacyVersion)}" />
            <label class="maintenance-note"><input type="checkbox" name="consent" required /> ${localCopy(locale,"Notify me when CMSMotive reopens. This is separate from the newsletter.","Benachrichtigen Sie mich bei Wiedereröffnung. Dies ist getrennt vom Newsletter.","CMSMotive yeniden açıldığında haber almak istiyorum. Bu izin bültenden ayrıdır.")}</label>
            <p class="maintenance-note" id="signup-note">${localCopy(locale,"Confirm the request using the email we send you.","Bestätigen Sie die Anfrage über die zugesandte E-Mail.","Gönderilen e-postadan talebinizi doğrulayın.")} <a href="${locale==="de"?"":`/${locale}`}/privacy">${localCopy(locale,"Privacy","Datenschutz","Gizlilik")}</a></p>
            <p class="maintenance-status" id="signup-status" data-maintenance-status role="status" aria-live="polite" aria-atomic="true"></p>
            ${preview ? "" : `<noscript><p class="maintenance-note">${copy.noscript}</p></noscript>`}
          </form>
        </div>
      </section>
      <div class="maintenance-art" aria-hidden="true">
        <div class="maintenance-sheet maintenance-sheet-back"></div>
        <div class="maintenance-sheet maintenance-sheet-middle"></div>
        <div class="maintenance-board">
          <div class="maintenance-board-head"><img src="/assets/images/logo.png" alt="" width="108" height="36" /><span></span><span></span></div>
          <div class="maintenance-board-hero"><img src="/assets/images/logo.png" alt="" width="168" height="56" /><div><i></i><i></i><i></i></div></div>
          <div class="maintenance-board-grid"><div><i></i><span></span><span></span></div><div><i></i><span></span><span></span></div><div><i></i><span></span><span></span></div></div>
          <div class="maintenance-board-foot"><span></span><span></span></div>
        </div>
        <div class="maintenance-art-note"><svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l3.5-.5L20 7a2.8 2.8 0 0 0-4-4L3.5 15.5 3 20Z" /></svg>${copy.art}</div>
      </div>
    </main>
    <footer class="maintenance-footer maintenance-shell">
      <p>${copy.contact} <a href="mailto:hello@cmsmotive.de">hello@cmsmotive.de</a></p>
      <span>© ${new Date().getFullYear()} CMSMotive</span>
    </footer>
  </body>
</html>`;
}
