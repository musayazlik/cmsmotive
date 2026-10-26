import Link from "next/link";
import type { CustomerDashboard } from "@/lib/customer-dashboard";
import { LOCALE_TAGS, localizePath, type Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { formatAmount } from "@/lib/prices";
import { AccountEmpty, AccountHeading, AccountIcon } from "./account-ui";

type Props = {
  user: { name: string; email: string; emailVerified: boolean };
  locale: Locale;
  dashboard: CustomerDashboard;
  billingLinks: Record<string, string>;
  checkoutPending?: boolean;
};

export default function DashboardView({ user, locale: l, dashboard, billingLinks, checkoutPending }: Props) {
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });
  const number = new Intl.NumberFormat(LOCALE_TAGS[l]);
  const name = user.name.trim().split(/\s+/)[0];
  const accountHref = (path: string) => `${path}?lang=${l}`;
  const paymentStatus = (value: string, type: string) => {
    if (["refund", "refunded"].includes(type)) return copy(l, "Refund", "Erstattung", "İade");
    if (["completed", "paid"].includes(value)) return copy(l, "Paid", "Bezahlt", "Ödendi");
    if (value === "refunded") return copy(l, "Refunded", "Erstattet", "İade edildi");
    if (value === "failed") return copy(l, "Failed", "Fehlgeschlagen", "Başarısız");
    if (value === "disputed") return copy(l, "Disputed", "Angefochten", "İtiraz edildi");
    return copy(l, "Processing", "In Bearbeitung", "İşleniyor");
  };
  const stats = [
    { icon: "products", label: copy(l, "Purchased products", "Gekaufte Produkte", "Satın alınan ürün"), value: dashboard.productCount, note: copy(l, "Across all your stores", "Aus allen Ihren Shops", "Tüm mağazalardaki ürünleriniz"), href: "/account/products" },
    { icon: "download", label: copy(l, "Available files", "Verfügbare Dateien", "İndirilebilir dosya"), value: dashboard.fileCount, note: copy(l, "Included in your purchases", "In Ihren Käufen enthalten", "Satın alımlarınıza dahil sürümler"), href: "/account/downloads" },
    { icon: "billing", label: copy(l, "Active subscriptions", "Aktive Abonnements", "Aktif abonelik"), value: dashboard.activeSubscriptionCount, note: copy(l, "Within their access period", "Im Zugriffszeitraum", "Erişim dönemi devam eden"), href: "#dashboard-subscriptions" },
    { icon: "clock", label: copy(l, "Awaiting a package", "Paket ausstehend", "Paket bekleyen ürün"), value: dashboard.awaitingPackageCount, note: copy(l, "Not uploaded by the seller yet", "Noch kein Upload vom Anbieter", "Satıcı henüz dosya yüklememiş"), href: "/account/downloads" },
  ] as const;

  return (
    <div className="customer-dashboard">
      <div className="customer-dashboard-eyebrow">{copy(l, "Account overview", "Kontoübersicht", "Hesap özeti")}</div>
      <AccountHeading
        title={name ? copy(l, `Welcome back, ${name}`, `Willkommen zurück, ${name}`, `Hoş geldiniz, ${name}`) : copy(l, "Welcome back", "Willkommen zurück", "Hoş geldiniz")}
        description={copy(l, "Your products, files and upcoming subscription dates at a glance. All stores, one account.", "Ihre Produkte, Dateien und anstehenden Abotermine auf einen Blick. Alle Shops, ein Konto.", "Ürünleriniz, dosyalarınız ve yaklaşan abonelik tarihleriniz bir bakışta. Tüm mağazalar, tek hesap.")}
        action={<Link className="wbtn wbtn-primary" href={accountHref("/account/downloads")}><AccountIcon name="download" />{copy(l, "My files", "Meine Dateien", "Dosyalarım")}</Link>}
      />
      {checkoutPending ? <div className="customer-notice" role="status"><AccountIcon name="clock" /><p>{copy(l, "Your payment is being verified. Your purchase appears after payment confirmation. Refresh this page to check again.", "Ihre Zahlung wird geprüft. Ihr Kauf erscheint nach Zahlungsbestätigung. Aktualisieren Sie diese Seite, um erneut zu prüfen.", "Ödemeniz doğrulanıyor. Satın alımınız ödeme onayından sonra görünür. Durumu kontrol etmek için bu sayfayı yenileyebilirsiniz.")}</p></div> : null}

      <div className="customer-dashboard-stats">
        {stats.map((stat) => (
          <Link className="customer-card customer-dashboard-stat" href={stat.href.startsWith("#") ? stat.href : accountHref(stat.href)} key={stat.icon}>
            <span className="customer-dashboard-stat-top"><span>{stat.label}</span><AccountIcon name={stat.icon} /></span>
            <strong>{number.format(stat.value)}</strong>
            <span className="customer-dashboard-stat-note">{stat.note}<AccountIcon name="arrow" /></span>
          </Link>
        ))}
      </div>

      <div className="customer-dashboard-grid">
        <div className="customer-stack">
          <section className="customer-card" aria-labelledby="dashboard-files-title">
            <header className="customer-card-head">
              <h2 id="dashboard-files-title">{copy(l, "Latest available versions", "Aktuelle verfügbare Versionen", "Son indirilebilir sürümler")}</h2>
              <Link className="customer-dashboard-link" href={accountHref("/account/downloads")}>{copy(l, "All files", "Alle Dateien", "Tüm dosyalar")}<AccountIcon name="arrow" /></Link>
            </header>
            {dashboard.latestFiles.length ? (
              <ul className="customer-records">
                {dashboard.latestFiles.map((file) => (
                  <li className="customer-record customer-dashboard-file" key={file.id}>
                    <span className="customer-dashboard-record-icon"><AccountIcon name="download" /></span>
                    <div><strong>{file.productName}</strong><p>{file.version} · <time dateTime={file.createdAt.toISOString()}>{date.format(file.createdAt)}</time></p><small>{file.storeName} · {file.fileName}</small></div>
                    <a className="wbtn wbtn-ghost" href={`/api/downloads/${file.id}`} aria-label={`${copy(l, "Download", "Herunterladen", "İndir")}: ${file.productName} ${file.version}`}><AccountIcon name="download" /><span>{copy(l, "Download", "Herunterladen", "İndir")}</span></a>
                  </li>
                ))}
              </ul>
            ) : (
              <AccountEmpty icon="download" title={copy(l, "Your files will appear here", "Hier erscheinen Ihre Dateien", "Dosyalarınız burada görünecek")}
                description={dashboard.productCount ? copy(l, "No downloadable version is covered by your purchases yet. Check My files for delivery status.", "Noch ist keine herunterladbare Version für Ihre Käufe verfügbar. Den Lieferstatus finden Sie unter Meine Dateien.", "Satın alımlarınıza dahil indirilebilir sürüm henüz yok. Teslimat durumunu Dosyalarım bölümünden görebilirsiniz.") : copy(l, "After your first purchase, your available product versions will be listed here.", "Nach Ihrem ersten Kauf finden Sie hier Ihre verfügbaren Produktversionen.", "İlk satın alımınızdan sonra erişiminize dahil ürün sürümleri burada listelenecek.")}>
                <Link className="wbtn wbtn-ghost" href={dashboard.productCount ? accountHref("/account/downloads") : localizePath("/products", l)}>{dashboard.productCount ? copy(l, "View my files", "Meine Dateien ansehen", "Dosyalarımı görüntüle") : copy(l, "Explore products", "Produkte entdecken", "Ürünleri keşfet")}</Link>
              </AccountEmpty>
            )}
            {dashboard.awaitingPackageCount > 0 ? <div className="customer-card-note"><AccountIcon name="clock" /><p>{copy(l, `${dashboard.awaitingPackageCount} of your products have no package uploaded yet. Files will appear when the seller uploads them.`, `Für ${dashboard.awaitingPackageCount} Ihrer Produkte wurde noch kein Paket hochgeladen. Dateien erscheinen nach dem Upload durch den Anbieter.`, `${dashboard.awaitingPackageCount} ürününüz için henüz paket yüklenmemiş. Satıcı yüklediğinde dosyalar görünecek.`)}</p></div> : null}
          </section>

          <section className="customer-card" aria-labelledby="dashboard-payments-title">
            <header className="customer-card-head"><h2 id="dashboard-payments-title">{copy(l, "Recent payments", "Letzte Zahlungen", "Son ödemeler")}</h2><AccountIcon name="receipt" className="customer-heading-icon" /></header>
            {dashboard.payments.length ? (
              <ul className="customer-records">
                {dashboard.payments.map((payment) => (
                  <li className="customer-record" key={payment.id}>
                    <div><strong>{payment.order?.product.name ?? payment.subscription?.product.name ?? copy(l, "Payment", "Zahlung", "Ödeme")}</strong><p>{payment.store.name} · <time dateTime={payment.occurredAt.toISOString()}>{date.format(payment.occurredAt)}</time></p><a className="customer-dashboard-link" href={billingLinks[payment.storeId]}>{copy(l, "Billing details", "Zahlungsdetails", "Ödeme ayrıntıları")}<AccountIcon name="arrow" /></a></div>
                    <div className="customer-record-amount"><strong>{formatAmount(payment.amountCents, payment.currency, LOCALE_TAGS[l])}</strong><span className="customer-status" data-positive={["completed", "paid"].includes(payment.status) && !["refund", "refunded"].includes(payment.type)}>{paymentStatus(payment.status, payment.type)}</span></div>
                  </li>
                ))}
              </ul>
            ) : <AccountEmpty icon="receipt" title={copy(l, "No payments yet", "Noch keine Zahlungen", "Henüz ödeme yok")} description={copy(l, "Your payment history will appear here after your first transaction.", "Nach Ihrer ersten Transaktion erscheint hier Ihr Zahlungsverlauf.", "İlk işleminizden sonra ödeme geçmişiniz burada görünecek.")} />}
          </section>
        </div>

        <div className="customer-stack">
          <section className="customer-card customer-dashboard-account" aria-labelledby="dashboard-account-title">
            <header className="customer-card-head"><h2 id="dashboard-account-title">{copy(l, "Your account", "Ihr Konto", "Hesabınız")}</h2><AccountIcon name="shield" className="customer-heading-icon" /></header>
            <div className="customer-dashboard-account-body">
              <span className="customer-status" data-positive={user.emailVerified}>{user.emailVerified ? copy(l, "Email verified", "E-Mail bestätigt", "E-posta doğrulandı") : copy(l, "Email verification needed", "E-Mail-Bestätigung erforderlich", "E-posta doğrulaması gerekiyor")}</span>
              <strong>{user.email}</strong>
              <p>{user.emailVerified ? copy(l, "Your account can access the files included in your purchases.", "Ihr Konto kann auf die in Ihren Käufen enthaltenen Dateien zugreifen.", "Hesabınız satın alımlarınıza dahil dosyalara erişebilir.") : copy(l, "Verify your email to download your purchased files.", "Bestätigen Sie Ihre E-Mail, um gekaufte Dateien herunterzuladen.", "Satın aldığınız dosyaları indirmek için e-postanızı doğrulayın.")}</p>
              <Link className="customer-dashboard-link" href={accountHref("/account/profile")}>{copy(l, "Account & security", "Konto & Sicherheit", "Hesap ve güvenlik")}<AccountIcon name="arrow" /></Link>
            </div>
          </section>

          <section className="customer-card" id="dashboard-subscriptions" aria-labelledby="dashboard-subscriptions-title">
            <header className="customer-card-head"><h2 id="dashboard-subscriptions-title">{copy(l, "Subscription periods", "Abonnementzeiträume", "Abonelik dönemleri")}</h2><span className="customer-count">{number.format(dashboard.activeSubscriptionCount)}</span></header>
            {dashboard.subscriptions.length ? (
              <ul className="customer-records">
                {dashboard.subscriptions.map((subscription) => (
                  <li className="customer-record customer-dashboard-subscription" key={subscription.id}><div>
                    <strong>{subscription.product.name}</strong><p>{subscription.price.name} · {subscription.store.name}</p>
                    <span className="customer-dashboard-date"><AccountIcon name="calendar" /><time dateTime={subscription.currentPeriodEnd.toISOString()}>{date.format(subscription.currentPeriodEnd)}</time></span>
                    <p>{subscription.status === "scheduled_cancel" ? copy(l, "Cancellation scheduled. Access continues until this date.", "Kündigung vorgemerkt. Der Zugriff bleibt bis zu diesem Datum bestehen.", "İptal planlandı. Bu tarihe kadar erişiminiz devam eder.") : subscription.status === "trialing" ? copy(l, "Your trial period ends on this date.", "Ihr Testzeitraum endet an diesem Datum.", "Deneme döneminiz bu tarihte sona erer.") : copy(l, "Your current paid period ends on this date.", "Ihr aktueller bezahlter Zeitraum endet an diesem Datum.", "Mevcut ücretli döneminiz bu tarihte sona erer.")}</p>
                    <a className="customer-dashboard-link" href={billingLinks[subscription.storeId]}>{copy(l, "Manage subscription", "Abo verwalten", "Aboneliği yönet")}<AccountIcon name="arrow" /></a>
                  </div></li>
                ))}
              </ul>
            ) : <AccountEmpty icon="billing" title={copy(l, "No active subscriptions", "Keine aktiven Abonnements", "Aktif abonelik yok")} description={copy(l, "One-time purchases do not require a subscription. Your included downloads remain in My files.", "Einmalkäufe benötigen kein Abonnement. Ihre enthaltenen Downloads bleiben unter Meine Dateien.", "Tek seferlik satın alımlar abonelik gerektirmez. Dahil olan indirmeleriniz Dosyalarım bölümünde kalır.")} />}
          </section>
        </div>
      </div>
      <div className="customer-dashboard-help"><AccountIcon name="shield" /><p>{copy(l, "Versions included in your paid update period stay downloadable after it ends. Find licence keys and product details in My products.", "Versionen aus Ihrem bezahlten Updatezeitraum bleiben danach herunterladbar. Lizenzschlüssel und Produktdetails finden Sie unter Meine Produkte.", "Ücretli güncelleme döneminizdeki sürümler, dönem bittikten sonra da indirilebilir kalır. Lisans anahtarlarını ve ürün ayrıntılarını Ürünlerim bölümünde bulabilirsiniz.")}</p><Link className="customer-dashboard-link" href={accountHref("/account/products")}>{copy(l, "My products", "Meine Produkte", "Ürünlerim")}<AccountIcon name="arrow" /></Link></div>
    </div>
  );
}
