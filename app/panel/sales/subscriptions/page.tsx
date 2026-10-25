import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { formatAmount } from "@/lib/prices";
import { prisma } from "@/lib/prisma";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

/** Creem states that count as an ongoing relationship; local reversals are never active. */
const ACTIVE_STATUSES = ["active", "trialing", "past_due", "scheduled_cancel"];

const BADGES: Record<string, string> = {
  active: "wbadge wbadge-verified",
  trialing: "wbadge wbadge-verified",
  scheduled_cancel: "wbadge wbadge-pending",
  past_due: "wbadge wbadge-pending",
  canceled: "wbadge wbadge-missing",
  expired: "wbadge wbadge-missing",
  unpaid: "wbadge wbadge-missing",
  paused: "wbadge wbadge-user",
  refunded: "wbadge wbadge-missing",
  disputed: "wbadge wbadge-missing",
};

const date = (value: Date) => value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Every subscription of the store with the latest state Creem reported. */
export default async function SubscriptionsPage() {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const [running, subscriptions] = await Promise.all([
    prisma.subscription.count({ where: { storeId, status: { in: ACTIVE_STATUSES } } }),
    prisma.subscription.findMany({
      where: { storeId },
      orderBy: { providerUpdatedAt: "desc" },
      take: 200,
      include: {
        customer: { select: { email: true } },
        product: { select: { name: true } },
        price: { select: { name: true, amountCents: true, currency: true } },
      },
    }),
  ]);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SALES / SUBSCRIPTIONS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Every <em>subscription.</em>
          </h1>
          <p>
            The latest state Creem reported for each subscription, including cancellations and refunds. Renewals and
            their transactions arrive through the webhook; customers manage payment details and cancellation in the
            portal Creem hosts.
          </p>
        </div>
        <span className="workspace-index">SALES</span>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div>
            <span className="status-title">SUBSCRIPTIONS</span>
            <p className="status-caption">
              {running} running · {subscriptions.length} on record
            </p>
          </div>
          <div className="wtable-tools">
            <Link className="wbtn wbtn-ghost" href="/panel/sales/orders">
              Orders →
            </Link>
          </div>
        </div>
        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Current period</th>
                <th scope="col">Updated</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    No subscriptions yet. They appear here as soon as a recurring checkout completes.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>
                      <strong>{subscription.customer.email}</strong>
                    </td>
                    <td>{subscription.product.name}</td>
                    <td>
                      {subscription.price.name}
                      <small className="wreview-type"> · {formatAmount(subscription.price.amountCents, subscription.price.currency)}</small>
                    </td>
                    <td>
                      <span className="wtable-date">
                        {date(subscription.currentPeriodStart)} – {date(subscription.currentPeriodEnd)}
                      </span>
                    </td>
                    <td>
                      <span className="wtable-date">{date(subscription.providerUpdatedAt)}</span>
                    </td>
                    <td>
                      <span className={BADGES[subscription.status] ?? "wbadge wbadge-user"}>{subscription.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
