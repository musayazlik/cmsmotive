import Link from "next/link";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { presentNotifications } from "@/lib/notification-text";
import { loadNotificationPreferences, loadNotifications } from "@/lib/notifications";
import { AccountEmpty, AccountHeading, AccountIcon } from "../account-ui";
import { markNotificationsReadAction, saveNotificationPreferencesAction } from "./_actions";

/** Everything we told the customer, and which of it may also arrive by email. */
export default async function NotificationsPage() {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const [rows, preferences] = await Promise.all([loadNotifications(user.id, storeId), loadNotificationPreferences(user.id)]);
  const items = presentNotifications(rows, l);
  const unread = items.filter((item) => !item.read).length;

  return (
    <>
      <AccountHeading
        title={copy(l, "Notifications", "Benachrichtigungen", "Bildirimler")}
        description={copy(
          l,
          "New versions of your products, renewal reminders and payment updates.",
          "Neue Versionen Ihrer Produkte, Verlängerungserinnerungen und Zahlungshinweise.",
          "Ürünlerinizin yeni sürümleri, yenileme hatırlatmaları ve ödeme bilgilendirmeleri.",
        )}
        action={
          unread > 0 ? (
            <form action={markNotificationsReadAction.bind(null, undefined)}>
              <button className="wbtn" type="submit">
                <AccountIcon name="check" />
                {copy(l, "Mark all as read", "Alle als gelesen markieren", "Tümünü okundu işaretle")}
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="customer-columns">
        <section className="customer-card" aria-labelledby="notifications-title">
          <header className="customer-card-head">
            <h2 id="notifications-title">{copy(l, "Latest messages", "Letzte Nachrichten", "Son mesajlar")}</h2>
            <span className="customer-count">{unread > 0 ? `${unread} ${copy(l, "new", "neu", "yeni")}` : items.length}</span>
          </header>
          {!items.length ? (
            <AccountEmpty
              icon="bell"
              title={copy(l, "No notifications yet", "Noch keine Benachrichtigungen", "Henüz bildirim yok")}
              description={copy(
                l,
                "We will tell you here when a new version of one of your products is released or a renewal is coming up.",
                "Hier erfahren Sie, wenn eine neue Version Ihrer Produkte erscheint oder eine Verlängerung ansteht.",
                "Ürünlerinizden biri için yeni sürüm yayınlandığında veya bir yenileme yaklaştığında burada haber vereceğiz.",
              )}
            />
          ) : (
            <ul className="customer-records customer-notifications">
              {items.map((item) => (
                <li className="customer-record" key={item.id} data-unread={!item.read}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <Link className="customer-text-link" href={`${item.href}?lang=${l}`}>
                      {copy(l, "Open", "Öffnen", "Aç")}
                      <AccountIcon name="arrow" />
                    </Link>
                  </div>
                  <span className="customer-notification-time">
                    {!item.read && <i aria-label={copy(l, "Unread", "Ungelesen", "Okunmadı")} />}
                    {item.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="customer-stack" aria-label={copy(l, "Email settings", "E-Mail-Einstellungen", "E-posta ayarları")}>
          <section className="customer-card customer-aside">
            <AccountIcon name="mail" />
            <h2>{copy(l, "Email me about", "Per E-Mail benachrichtigen über", "E-posta ile haber ver")}</h2>
            <form action={saveNotificationPreferencesAction} className="customer-switches">
              <label>
                <input type="checkbox" name="emailReleases" defaultChecked={preferences.emailReleases} />
                <span>
                  <strong>{copy(l, "New versions", "Neue Versionen", "Yeni sürümler")}</strong>
                  {copy(l, "When a product you own gets a new release.", "Wenn ein Produkt, das Sie besitzen, eine neue Version erhält.", "Sahip olduğunuz bir ürünün yeni sürümü çıktığında.")}
                </span>
              </label>
              <label>
                <input type="checkbox" name="emailBilling" defaultChecked={preferences.emailBilling} />
                <span>
                  <strong>{copy(l, "Subscriptions & updates", "Abonnements & Updates", "Abonelikler ve güncellemeler")}</strong>
                  {copy(
                    l,
                    "Renewal reminders, purchase confirmations and when your update period ends.",
                    "Verlängerungserinnerungen, Kaufbestätigungen und das Ende Ihres Update-Zeitraums.",
                    "Yenileme hatırlatmaları, satın alma onayları ve güncelleme sürenizin bitişi.",
                  )}
                </span>
              </label>
              <button className="wbtn wbtn-primary" type="submit">
                {copy(l, "Save", "Speichern", "Kaydet")}
              </button>
            </form>
            <p className="customer-portal-note">
              {copy(
                l,
                "Failed-payment notices are always emailed so your subscription is not interrupted. Everything stays visible here either way.",
                "Hinweise zu fehlgeschlagenen Zahlungen senden wir immer per E-Mail, damit Ihr Abonnement nicht unterbrochen wird. Hier bleibt alles in jedem Fall sichtbar.",
                "Başarısız ödeme bildirimleri aboneliğiniz kesilmesin diye her zaman e-postayla gönderilir. Tüm bildirimler her durumda burada görünür.",
              )}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
