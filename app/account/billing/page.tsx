import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { creemMode } from "@/lib/creem";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
export default async function BillingPage() {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  const subscriptions = await prisma.productSubscription.findMany({
    where: { userId: user.id, mode: creemMode() },
    orderBy: { createdAt: "desc" },
  });
  const plans = await prisma.billingPlan.findMany({
    where: { id: { in: subscriptions.map((s) => s.planId) } },
  });
  return (
    <>
      <div className="workspace-title-row">
        <div>
          <h1>
            {copy(
              l,
              "Subscriptions & invoices",
              "Abos & Rechnungen",
              "Abonelikler ve faturalar",
            )}
          </h1>
          <p>
            {copy(
              l,
              "Annual recurring billing is processed by Creem. Manage payment methods, invoices, cancellations and refund requests in the secure portal.",
              "Creem verarbeitet die jährliche Abrechnung. Zahlungsmethoden, Rechnungen, Kündigungen und Erstattungsanfragen verwalten Sie im sicheren Portal.",
              "Yıllık tekrarlayan ödemeler Creem üzerinden işlenir. Kart, fatura, iptal ve iade taleplerini güvenli portaldan yönetin.",
            )}
          </p>
        </div>
      </div>
      {!subscriptions.length && (
        <p>
          {copy(
            l,
            "No subscriptions yet.",
            "Noch keine Abonnements.",
            "Henüz abonelik yok.",
          )}
        </p>
      )}
      {subscriptions.map((s) => (
        <section className="wtable-card wsettings-section" key={s.id}>
          <h2>
            {plans.find((p) => p.id === s.planId)?.name ?? "Subscription"}
          </h2>
          <p>
            {s.status} · {s.currentPeriodStart.toLocaleDateString(l)} –{" "}
            {s.currentPeriodEnd.toLocaleDateString(l)}
          </p>
          <form action="/api/billing/portal" method="post">
            <input type="hidden" name="subscriptionId" value={s.id} />
            <button className="wbtn wbtn-primary">
              {copy(
                l,
                "Manage billing / cancel subscription",
                "Abrechnung verwalten / Abo kündigen",
                "Faturaları yönet / aboneliği iptal et",
              )}
            </button>
          </form>
        </section>
      ))}
      <p>
        <a href="mailto:info@cmsmotive.de">info@cmsmotive.de</a> ·{" "}
        {copy(
          l,
          "You can also send a cancellation or rights request by email. Mandatory consumer rights remain unaffected.",
          "Kündigungen und Rechtsanfragen sind auch per E-Mail möglich. Zwingende Verbraucherrechte bleiben unberührt.",
          "İptal veya hak başvurunuzu e-postayla da iletebilirsiniz. Emredici tüketici hakları saklıdır.",
        )}
      </p>
    </>
  );
}
