import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { creemMode } from "@/lib/creem";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { currentStoreId } from "@/lib/current-store";
import { getLegalSettings } from "@/lib/legal";
import { formatAmount } from "@/lib/prices";

/** Subscriptions and payment history in this store; invoices themselves come from Creem (merchant of record). */
export default async function BillingPage() {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const [customers, legal] = await Promise.all([
    prisma.customer.findMany({
      where: { storeId, userId: user.id, mode: creemMode() },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          include: { product: { select: { name: true } }, price: { select: { name: true } } },
        },
        transactions: { orderBy: { occurredAt: "desc" }, take: 50 },
      },
    }),
    getLegalSettings(storeId),
  ]);
  const subscriptions = customers.flatMap((customer) => customer.subscriptions);
  const transactions = customers.flatMap((customer) => customer.transactions).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });

  return (
    <>
      <div className="workspace-title-row">
        <div>
          <h1>{copy(l, "Subscriptions & invoices", "Abos & Rechnungen", "Abonelikler ve faturalar")}</h1>
          <p>
            {copy(
              l,
              "Payments are processed by Creem, which issues the invoices. Manage payment methods, invoices, cancellations and refund requests in the secure portal.",
              "Zahlungen verarbeitet Creem, das auch die Rechnungen ausstellt. Zahlungsmethoden, Rechnungen, Kündigungen und Erstattungsanfragen verwalten Sie im sicheren Portal.",
              "Ödemeler, faturaları da düzenleyen Creem üzerinden işlenir. Kart, fatura, iptal ve iade taleplerini güvenli portaldan yönetin.",
            )}
          </p>
        </div>
      </div>

      {customers.length > 0 && (
        <form action="/api/billing/portal" method="post" className="wsettings-section">
          <input type="hidden" name="customerId" value={customers[0].id} />
          <button className="wbtn wbtn-primary">
            {copy(l, "Open billing portal", "Abrechnungsportal öffnen", "Fatura portalını aç")}
          </button>
        </form>
      )}

      <section className="wtable-card wsettings-section">
        <h2>{copy(l, "Subscriptions", "Abonnements", "Abonelikler")}</h2>
        {!subscriptions.length ? (
          <p>{copy(l, "No subscriptions yet.", "Noch keine Abonnements.", "Henüz abonelik yok.")}</p>
        ) : (
          <ul>
            {subscriptions.map((subscription) => (
              <li key={subscription.id}>
                <strong>
                  {subscription.product.name} · {subscription.price.name}
                </strong>{" "}
                · {subscription.status} · {date.format(subscription.currentPeriodStart)} – {date.format(subscription.currentPeriodEnd)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wtable-card wsettings-section">
        <h2>{copy(l, "Payments", "Zahlungen", "Ödemeler")}</h2>
        {!transactions.length ? (
          <p>{copy(l, "No payments yet.", "Noch keine Zahlungen.", "Henüz ödeme yok.")}</p>
        ) : (
          <ul>
            {transactions.map((transaction) => (
              <li key={transaction.id}>
                {date.format(transaction.occurredAt)} · {formatAmount(transaction.amountPaidCents ?? transaction.amountCents, transaction.currency, LOCALE_TAGS[l])} ·{" "}
                {transaction.description ?? transaction.type} · {transaction.status}
                {transaction.refundedCents ? ` · ${copy(l, "refunded", "erstattet", "iade")} ${formatAmount(transaction.refundedCents, transaction.currency, LOCALE_TAGS[l])}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="wfield-hint-block">
          {copy(
            l,
            "Invoice documents are available in the billing portal and in the emails from Creem.",
            "Rechnungsdokumente finden Sie im Abrechnungsportal und in den E-Mails von Creem.",
            "Fatura belgeleri fatura portalında ve Creem'den gelen e-postalarda yer alır.",
          )}
        </p>
      </section>

      {legal.contactEmail && (
        <p>
          <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a> ·{" "}
          {copy(
            l,
            "You can also send a cancellation or rights request by email. Mandatory consumer rights remain unaffected.",
            "Kündigungen und Rechtsanfragen sind auch per E-Mail möglich. Zwingende Verbraucherrechte bleiben unberührt.",
            "İptal veya hak başvurunuzu e-postayla da iletebilirsiniz. Emredici tüketici hakları saklıdır.",
          )}
        </p>
      )}
    </>
  );
}
