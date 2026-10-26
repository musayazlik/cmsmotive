import { LOCALE_TAGS, type Locale } from "./i18n/config";
import { copy } from "./legal-copy";
import { formatAmount } from "./prices";

/**
 * What a customer is told, and in which language. Notifications store only a
 * `type` and a small `data` payload; the words are produced here when the
 * message is shown or mailed, so a customer who switches language sees every
 * message in it. Pure: no database, usable from the account UI and tests.
 */

export const NOTIFICATION_TYPES = [
  "release.published",
  "purchase.confirmed",
  "purchase.refunded",
  "subscription.renewal_upcoming",
  "subscription.renewed",
  "subscription.cancel_scheduled",
  "subscription.ending_soon",
  "subscription.ended",
  "subscription.payment_failed",
  "updates.expiring",
  "subscription.plan_changed",
  "support.replied",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationData = {
  product: string;
  plan?: string;
  version?: string;
  /** ISO date: renewal, end of access or end of updates, depending on the type. */
  date?: string;
  amountCents?: number;
  currency?: string;
  recurring?: boolean;
  /** Support request subject (support.replied). */
  subject?: string;
};

/** Mail preference groups. `critical` messages (a failed payment, a support reply) are always mailed. */
export type NotificationCategory = "releases" | "billing" | "critical";

export const REMINDER_DAYS = 3;
/** One-time purchases: how long before the update window closes the customer is warned. */
export const UPDATES_REMINDER_DAYS = 7;

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function notificationCategory(type: NotificationType): NotificationCategory {
  if (type === "release.published") return "releases";
  if (type === "subscription.payment_failed" || type === "support.replied") return "critical";
  return "billing";
}

/**
 * What a webhook-driven subscription change means for the customer, if
 * anything: a renewal (the paid period moved forward), a failed payment, a
 * scheduled cancellation or the end of the subscription. One message at most,
 * and none when nothing changed, so a repeated or older event stays silent.
 */
export function subscriptionTransition(
  before: { status: string; currentPeriodEnd: Date },
  after: { status: string; currentPeriodEnd: Date },
): NotificationType | null {
  if (after.currentPeriodEnd > before.currentPeriodEnd && after.status === "active") return "subscription.renewed";
  if (after.status === before.status) return null;
  if (after.status === "past_due" || after.status === "unpaid") return "subscription.payment_failed";
  if (after.status === "scheduled_cancel") return "subscription.cancel_scheduled";
  if (after.status === "canceled" || after.status === "expired") return "subscription.ended";
  return null;
}

/** Where the message leads, inside the customer's account. */
export function notificationHref(type: NotificationType): string {
  switch (type) {
    case "release.published":
      return "/account/downloads";
    case "purchase.confirmed":
      return "/account/products";
    case "support.replied":
      return "/account/support";
    default:
      return "/account/billing";
  }
}

function day(iso: string | undefined, l: Locale) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "long", timeZone: "UTC" }).format(date);
}

function money(data: NotificationData, l: Locale) {
  return typeof data.amountCents === "number" && data.currency ? formatAmount(data.amountCents, data.currency, LOCALE_TAGS[l]) : "";
}

/** Title and body of a notification in the reader's language. */
export function renderNotification(type: NotificationType, data: NotificationData, l: Locale): { title: string; body: string } {
  const name = data.plan ? `${data.product} (${data.plan})` : data.product;
  const versioned = [data.product, data.version].filter(Boolean).join(" ");
  const when = day(data.date, l);
  const amount = money(data, l);
  switch (type) {
    case "release.published":
      return {
        title: copy(l, `${versioned} is available`, `${versioned} ist verfügbar`, `${versioned} yayında`),
        body: copy(
          l,
          `A new version of ${data.product} is ready. Download it from My files and check the changelog for what changed.`,
          `Eine neue Version von ${data.product} steht bereit. Laden Sie sie unter „Meine Dateien“ herunter und lesen Sie das Änderungsprotokoll.`,
          `${data.product} için yeni bir sürüm hazır. “Dosyalarım” bölümünden indirebilir, değişiklikler için sürüm notlarına bakabilirsiniz.`,
        ),
      };
    case "purchase.confirmed":
      return {
        title: copy(l, "Purchase confirmed", "Kauf bestätigt", "Satın alma onaylandı"),
        body: copy(
          l,
          `Thank you! ${name} is now in your account${amount ? ` (${amount})` : ""}. Your files and licence details are under My products and My files.`,
          `Vielen Dank! ${name} ist jetzt in Ihrem Konto${amount ? ` (${amount})` : ""}. Dateien und Lizenzdetails finden Sie unter „Meine Produkte“ und „Meine Dateien“.`,
          `Teşekkürler! ${name} artık hesabınızda${amount ? ` (${amount})` : ""}. Dosyalarınız ve lisans bilgileriniz “Ürünlerim” ve “Dosyalarım” bölümlerinde.`,
        ),
      };
    case "purchase.refunded":
      return {
        title: copy(l, "Refund processed", "Erstattung verarbeitet", "İade işlendi"),
        body: copy(
          l,
          `A refund for ${name} was processed. If it covers the full payment, access to its files ends.`,
          `Eine Erstattung für ${name} wurde verarbeitet. Bei voller Erstattung endet der Zugriff auf die Dateien.`,
          `${name} için bir iade işlendi. Ödemenin tamamı iade edildiyse dosyalara erişim sona erer.`,
        ),
      };
    case "subscription.renewal_upcoming":
      return {
        title: copy(l, "Your subscription renews soon", "Ihr Abonnement verlängert sich bald", "Aboneliğiniz yakında yenilenecek"),
        body: copy(
          l,
          `Your subscription to ${name} renews on ${when}${amount ? ` and ${amount} will be charged` : ""}. You can manage or cancel it in the billing portal before then.`,
          `Ihr Abonnement für ${name} verlängert sich am ${when}${amount ? `; ${amount} werden abgebucht` : ""}. Bis dahin können Sie es im Abrechnungsportal verwalten oder kündigen.`,
          `${name} aboneliğiniz ${when} tarihinde yenilenecek${amount ? ` ve ${amount} tahsil edilecek` : ""}. Bu tarihe kadar fatura portalından yönetebilir veya iptal edebilirsiniz.`,
        ),
      };
    case "subscription.renewed":
      return {
        title: copy(l, "Subscription renewed", "Abonnement verlängert", "Abonelik yenilendi"),
        body: copy(
          l,
          `Your subscription to ${name} was renewed${amount ? ` (${amount})` : ""}. Updates and support now run until ${when}.`,
          `Ihr Abonnement für ${name} wurde verlängert${amount ? ` (${amount})` : ""}. Updates und Support laufen jetzt bis ${when}.`,
          `${name} aboneliğiniz yenilendi${amount ? ` (${amount})` : ""}. Güncellemeler ve destek artık ${when} tarihine kadar geçerli.`,
        ),
      };
    case "subscription.cancel_scheduled":
      return {
        title: copy(l, "Cancellation scheduled", "Kündigung vorgemerkt", "İptal planlandı"),
        body: copy(
          l,
          `Your subscription to ${name} will not renew. Updates and support stay available until ${when}.`,
          `Ihr Abonnement für ${name} wird nicht verlängert. Updates und Support bleiben bis ${when} verfügbar.`,
          `${name} aboneliğiniz yenilenmeyecek. Güncellemeler ve destek ${when} tarihine kadar devam eder.`,
        ),
      };
    case "subscription.ending_soon":
      return {
        title: copy(l, "Your subscription ends soon", "Ihr Abonnement endet bald", "Aboneliğiniz yakında sona eriyor"),
        body: copy(
          l,
          `Your subscription to ${name} ends on ${when} and will not renew. Releases you already received stay downloadable.`,
          `Ihr Abonnement für ${name} endet am ${when} und wird nicht verlängert. Bereits erhaltene Versionen bleiben herunterladbar.`,
          `${name} aboneliğiniz ${when} tarihinde sona erecek ve yenilenmeyecek. Daha önce aldığınız sürümler indirilebilir kalır.`,
        ),
      };
    case "subscription.ended":
      return {
        title: copy(l, "Subscription ended", "Abonnement beendet", "Abonelik sona erdi"),
        body: copy(
          l,
          `Your subscription to ${name} has ended. Releases you already received stay downloadable; new versions need an active subscription.`,
          `Ihr Abonnement für ${name} ist beendet. Bereits erhaltene Versionen bleiben herunterladbar; neue Versionen erfordern ein aktives Abonnement.`,
          `${name} aboneliğiniz sona erdi. Daha önce aldığınız sürümler indirilebilir kalır; yeni sürümler için aktif abonelik gerekir.`,
        ),
      };
    case "subscription.payment_failed":
      return {
        title: copy(l, "Payment failed", "Zahlung fehlgeschlagen", "Ödeme başarısız"),
        body: copy(
          l,
          `We could not charge your payment method for ${name}. Please update it in the billing portal to keep your subscription active.`,
          `Die Zahlung für ${name} konnte nicht abgebucht werden. Bitte aktualisieren Sie Ihre Zahlungsmethode im Abrechnungsportal, damit Ihr Abonnement aktiv bleibt.`,
          `${name} için ödeme yönteminizden tahsilat yapılamadı. Aboneliğinizin aktif kalması için fatura portalından ödeme yönteminizi güncelleyin.`,
        ),
      };
    case "subscription.plan_changed":
      return {
        title: copy(l, "Plan changed", "Tarif geändert", "Plan değişti"),
        body: copy(
          l,
          `Your subscription to ${data.product} now runs on the ${data.plan ?? ""} plan. Any difference is settled by Creem on your next invoice or right away.`,
          `Ihr Abonnement für ${data.product} läuft jetzt im Tarif ${data.plan ?? ""}. Eine Differenz rechnet Creem sofort oder mit der nächsten Rechnung ab.`,
          `${data.product} aboneliğiniz artık ${data.plan ?? ""} planında. Fark, Creem tarafından hemen veya bir sonraki faturada tahsil edilir.`,
        ),
      };
    case "support.replied":
      return {
        title: copy(l, "New reply to your support request", "Neue Antwort auf Ihre Supportanfrage", "Destek talebinize yeni yanıt"),
        body: copy(
          l,
          `Our team replied to “${data.subject ?? data.product}”. Open the request to read it and answer.`,
          `Unser Team hat auf „${data.subject ?? data.product}“ geantwortet. Öffnen Sie die Anfrage, um die Antwort zu lesen.`,
          `Ekibimiz “${data.subject ?? data.product}” talebinize yanıt verdi. Okumak ve cevaplamak için talebi açın.`,
        ),
      };
    case "updates.expiring":
      return {
        title: copy(l, "Your update period ends soon", "Ihr Update-Zeitraum endet bald", "Güncelleme süreniz yakında doluyor"),
        body: copy(
          l,
          `The updates included with ${name} end on ${when}. Versions released until then stay downloadable.`,
          `Die in ${name} enthaltenen Updates enden am ${when}. Bis dahin veröffentlichte Versionen bleiben herunterladbar.`,
          `${name} ile gelen güncellemeler ${when} tarihinde sona eriyor. O tarihe kadar yayınlanan sürümler indirilebilir kalır.`,
        ),
      };
  }
}

/** Short relative time for the notification list ("5 min", "2 h", "3 d", then a date). */
export function relativeTime(from: Date, now: Date, l: Locale): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return copy(l, "just now", "gerade eben", "az önce");
  const formatter = new Intl.RelativeTimeFormat(LOCALE_TAGS[l], { numeric: "auto", style: "short" });
  if (seconds < 3600) return formatter.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return formatter.format(-Math.round(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return formatter.format(-Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" }).format(from);
}

/** A stored notification as the account UI shows it; unknown types (from a newer deploy) are dropped. */
export function presentNotifications(
  rows: { id: string; type: string; data: unknown; href: string | null; readAt: Date | null; createdAt: Date }[],
  l: Locale,
  now = new Date(),
) {
  return rows.flatMap((row) => {
    if (!isNotificationType(row.type)) return [];
    const { title, body } = renderNotification(row.type, (row.data ?? {}) as NotificationData, l);
    return [{
      id: row.id,
      title,
      body,
      href: row.href ?? notificationHref(row.type),
      time: relativeTime(row.createdAt, now, l),
      read: row.readAt !== null,
    }];
  });
}
