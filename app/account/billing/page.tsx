import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { creemMode } from "@/lib/creem";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { currentStoreId } from "@/lib/current-store";
import { getLegalSettings } from "@/lib/legal";
import { formatAmount } from "@/lib/prices";
import { AccountEmpty, AccountHeading, AccountIcon } from "../account-ui";

/** Subscriptions and payment history; invoice documents are issued by Creem. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [user, l, storeId, query] = await Promise.all([
    requireCustomer(),
    getRequestLocale(),
    currentStoreId(),
    searchParams,
  ]);
  const mode = creemMode();
  const [customers, legal] = await Promise.all([
    prisma.customer.findMany({
      where: { storeId, userId: user.id, mode },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          include: {
            product: { select: { name: true } },
            price: { select: { id: true, name: true, enabled: true, creemTestProductId: true, creemLiveProductId: true } },
          },
        },
        transactions: {
          orderBy: { occurredAt: "desc" },
          take: 50,
          include: { order: { select: { creemOrderId: true } } },
        },
      },
    }),
    getLegalSettings(storeId),
  ]);
  const subscriptions = customers.flatMap((customer) => customer.subscriptions);
  const transactions = customers
    .flatMap((customer) => customer.transactions)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });
  const active = subscriptions.filter((subscription) =>
    ["active", "trialing", "scheduled_cancel"].includes(subscription.status),
  ).length;

  return (
    <>
      <AccountHeading
        title={copy(
          l,
          "Subscriptions & invoices",
          "Abos & Rechnungen",
          "Abonelikler ve faturalar",
        )}
        description={copy(
          l,
          "Keep track of your subscriptions, payments and billing details.",
          "Ihre Abonnements, Zahlungen und Rechnungsdaten auf einen Blick.",
          "Aboneliklerinizi, ödemelerinizi ve fatura bilgilerinizi tek yerden takip edin.",
        )}
      />

      {query.plan === "changed" && (
        <p className="customer-banner" role="status">
          {copy(l, "Your plan was changed. Creem sends the receipt for the difference by email.", "Ihr Tarif wurde geändert. Creem sendet die Quittung für die Differenz per E-Mail.", "Planınız değiştirildi. Creem fark tutarının makbuzunu e-postayla gönderir.")}
        </p>
      )}

      <div className="customer-summary">
        <div className="customer-summary-item">
          <AccountIcon name="products" />
          <div>
            <span>
              {copy(
                l,
                "Active subscriptions",
                "Aktive Abonnements",
                "Aktif abonelikler",
              )}
            </span>
            <strong>{active}</strong>
          </div>
        </div>
        <div className="customer-summary-item">
          <AccountIcon name="receipt" />
          <div>
            <span>
              {copy(l, "Recent payments", "Letzte Zahlungen", "Son ödemeler")}
            </span>
            <strong>{transactions.length}</strong>
          </div>
        </div>
        <div className="customer-summary-item">
          <AccountIcon name="shield" />
          <div>
            <span>
              {copy(
                l,
                "Payment provider",
                "Zahlungsanbieter",
                "Ödeme sağlayıcısı",
              )}
            </span>
            <strong>Creem</strong>
          </div>
        </div>
      </div>

      <div className="customer-columns">
        <div className="customer-stack">
          <section
            className="customer-card"
            aria-labelledby="subscriptions-title"
          >
            <header className="customer-card-head">
              <h2 id="subscriptions-title">
                {copy(l, "Subscriptions", "Abonnements", "Abonelikler")}
              </h2>
              <span className="customer-count">{subscriptions.length}</span>
            </header>
            {!subscriptions.length ? (
              <AccountEmpty
                icon="products"
                title={copy(
                  l,
                  "No subscriptions yet",
                  "Noch keine Abonnements",
                  "Henüz abonelik yok",
                )}
                description={copy(
                  l,
                  "Your subscriptions and renewal dates will appear here after your first purchase.",
                  "Nach Ihrem ersten Kauf finden Sie hier Ihre Abonnements und Verlängerungstermine.",
                  "İlk satın alımınızdan sonra abonelikleriniz ve yenileme tarihleri burada görünecek.",
                )}
              />
            ) : (
              <ul className="customer-records">
                {subscriptions.map((subscription) => (
                  <li className="customer-record" key={subscription.id}>
                    <div>
                      <strong>{subscription.product.name}</strong>
                      <p>{subscription.price.name}</p>
                      <p>
                        <time
                          dateTime={subscription.currentPeriodStart.toISOString()}
                        >
                          {date.format(subscription.currentPeriodStart)}
                        </time>{" "}
                        –{" "}
                        <time
                          dateTime={subscription.currentPeriodEnd.toISOString()}
                        >
                          {date.format(subscription.currentPeriodEnd)}
                        </time>
                      </p>
                    </div>
                    <div className="customer-record-amount">
                      <span
                        className="customer-status"
                        data-positive={[
                          "active",
                          "trialing",
                          "scheduled_cancel",
                        ].includes(subscription.status)}
                      >
                        {subscription.status}
                      </span>
                      {["active", "trialing"].includes(subscription.status) && (
                        <a className="customer-renew-link" href={`/account/billing/change-plan?subscription=${subscription.id}&lang=${l}`}>
                          {copy(l, "Change plan", "Tarif wechseln", "Planı değiştir")}
                          <AccountIcon name="arrow" />
                        </a>
                      )}
                      {["canceled", "expired"].includes(subscription.status) &&
                        subscription.price.enabled &&
                        (mode === "prod" ? subscription.price.creemLiveProductId : subscription.price.creemTestProductId) && (
                          <a className="customer-renew-link" href={`/account/checkout?price=${subscription.price.id}&lang=${l}`}>
                            {copy(l, "Restart subscription", "Abonnement neu starten", "Aboneliği yeniden başlat")}
                            <AccountIcon name="arrow" />
                          </a>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="customer-card" aria-labelledby="payments-title">
            <header className="customer-card-head">
              <h2 id="payments-title">
                {copy(l, "Payment history", "Zahlungsverlauf", "Ödeme geçmişi")}
              </h2>
              <span className="customer-count">{transactions.length}</span>
            </header>
            {!transactions.length ? (
              <AccountEmpty
                icon="receipt"
                title={copy(
                  l,
                  "No payments yet",
                  "Noch keine Zahlungen",
                  "Henüz ödeme yok",
                )}
                description={copy(
                  l,
                  "Completed payments will appear here. You can find your invoices in the billing portal.",
                  "Abgeschlossene Zahlungen erscheinen hier. Ihre Rechnungen finden Sie im Abrechnungsportal.",
                  "Tamamlanan ödemeleriniz burada listelenir. Faturalarınıza fatura portalından ulaşabilirsiniz.",
                )}
              />
            ) : (
              <ul className="customer-records">
                {transactions.map((transaction) => (
                  <li className="customer-record" key={transaction.id}>
                    <div>
                      <strong>
                        {transaction.type === "invoice"
                          ? copy(l, "Invoice", "Rechnung", "Fatura")
                          : copy(l, "Payment", "Zahlung", "Ödeme")}
                        {transaction.description
                          ? ` · ${transaction.description}`
                          : ""}
                      </strong>
                      <p>
                        <time dateTime={transaction.occurredAt.toISOString()}>
                          {date.format(transaction.occurredAt)}
                        </time>
                      </p>
                      <p>
                        {copy(l, "Reference", "Referenz", "Referans")}:{" "}
                        {transaction.order?.creemOrderId ??
                          transaction.creemTransactionId}
                      </p>
                      {transaction.refundedCents ? (
                        <p>
                          {copy(l, "Refunded", "Erstattet", "İade edilen")}:{" "}
                          {formatAmount(
                            transaction.refundedCents,
                            transaction.currency,
                            LOCALE_TAGS[l],
                          )}
                        </p>
                      ) : null}
                      {/* Creem's API has no invoice URL; the document is in the customer's portal. */}
                      <form action="/api/billing/portal" method="post">
                        <input
                          type="hidden"
                          name="customerId"
                          value={transaction.customerId}
                        />
                        <button className="customer-text-link" type="submit">
                          {copy(
                            l,
                            "Open invoice in billing portal",
                            "Rechnung im Abrechnungsportal öffnen",
                            "Faturayı portalda aç",
                          )}
                          <AccountIcon name="external" />
                        </button>
                      </form>
                    </div>
                    <div className="customer-record-amount">
                      <strong>
                        {formatAmount(
                          transaction.amountPaidCents ??
                            transaction.amountCents,
                          transaction.currency,
                          LOCALE_TAGS[l],
                        )}
                      </strong>
                      <span
                        className="customer-status"
                        data-positive={["paid", "completed"].includes(
                          transaction.status,
                        )}
                      >
                        {["paid", "completed"].includes(transaction.status)
                          ? copy(l, "Paid", "Bezahlt", "Ödendi")
                          : transaction.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="customer-card-note">
              <AccountIcon name="receipt" />
              <p>
                {copy(
                  l,
                  "Invoice documents are available in the billing portal and in the emails from Creem.",
                  "Rechnungsdokumente finden Sie im Abrechnungsportal und in den E-Mails von Creem.",
                  "Fatura belgeleri fatura portalında ve Creem'den gelen e-postalarda yer alır.",
                )}
              </p>
            </div>
          </section>
        </div>

        <aside
          className="customer-stack"
          aria-label={copy(
            l,
            "Billing help",
            "Hilfe zur Abrechnung",
            "Fatura yardımı",
          )}
        >
          <section className="customer-card customer-aside customer-portal">
            <div className="customer-portal-brand">
              <strong>Creem</strong>
              <AccountIcon name="shield" />
            </div>
            <h2>
              {copy(
                l,
                "Your billing portal",
                "Ihr Abrechnungsportal",
                "Fatura portalınız",
              )}
            </h2>
            <p>
              {copy(
                l,
                "Payments are processed by Creem, which issues your invoices. Manage payment methods, invoices, cancellations and refund requests in the secure portal.",
                "Creem verarbeitet Ihre Zahlungen und stellt Rechnungen aus. Zahlungsmethoden, Rechnungen, Kündigungen und Erstattungen verwalten Sie im sicheren Portal.",
                "Ödemelerinizi Creem işler ve faturalarınızı düzenler. Ödeme yöntemlerinizi, faturalarınızı, iptal ve iade taleplerinizi güvenli portaldan yönetin.",
              )}
            </p>
            {customers.length > 0 ? (
              customers.map((customer, index) => (
                <form
                  action="/api/billing/portal"
                  method="post"
                  key={customer.id}
                >
                  <input type="hidden" name="customerId" value={customer.id} />
                  <button className="wbtn wbtn-primary" type="submit">
                    {copy(
                      l,
                      "Open billing portal",
                      "Abrechnungsportal öffnen",
                      "Fatura portalını aç",
                    )}
                    {customers.length > 1 ? ` (${index + 1})` : ""}
                    <AccountIcon name="external" />
                  </button>
                </form>
              ))
            ) : (
              <a
                className="wbtn wbtn-primary"
                href={localizePath("/products", l)}
              >
                {copy(
                  l,
                  "Explore products",
                  "Produkte entdecken",
                  "Ürünleri keşfet",
                )}
                <AccountIcon name="arrow" />
              </a>
            )}
            {!customers.length && (
              <p className="customer-portal-note">
                {copy(
                  l,
                  "Your billing portal becomes available after your first purchase.",
                  "Ihr Abrechnungsportal steht nach Ihrem ersten Kauf zur Verfügung.",
                  "Fatura portalınız ilk satın alımınızdan sonra kullanıma açılır.",
                )}
              </p>
            )}
          </section>
          {legal.contactEmail && (
            <section className="customer-card customer-aside">
              <AccountIcon name="mail" />
              <h2>
                {copy(
                  l,
                  "Need a hand?",
                  "Brauchen Sie Hilfe?",
                  "Yardıma mı ihtiyacınız var?",
                )}
              </h2>
              <p>
                {copy(
                  l,
                  "You can also send a cancellation or rights request by email. Mandatory consumer rights remain unaffected.",
                  "Kündigungen und Rechtsanfragen sind auch per E-Mail möglich. Zwingende Verbraucherrechte bleiben unberührt.",
                  "İptal veya hak başvurunuzu e-postayla da iletebilirsiniz. Emredici tüketici hakları saklıdır.",
                )}
              </p>
              <a
                className="customer-text-link"
                href={`mailto:${legal.contactEmail}`}
              >
                {legal.contactEmail}
                <AccountIcon name="external" />
              </a>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
