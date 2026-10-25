import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { formatAmount } from "@/lib/prices";
import { prisma } from "@/lib/prisma";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

const BADGES: Record<string, string> = {
  succeeded: "wbadge wbadge-verified",
  paid: "wbadge wbadge-verified",
  refund: "wbadge wbadge-missing",
  refunded: "wbadge wbadge-missing",
  failed: "wbadge wbadge-missing",
  pending: "wbadge wbadge-pending",
};

const date = (value: Date) => value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Every money movement Creem recorded for the store: payments, renewals and
 * refunds. Creem is the merchant of record and issues the invoice documents,
 * so this is the ledger view, not a document store.
 */
export default async function InvoicesPage() {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const transactions = await prisma.transaction.findMany({
    where: { storeId },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: { customer: { select: { email: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SALES / INVOICES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Every <em>transaction.</em>
          </h1>
          <p>
            Payments, renewals and refunds as Creem recorded them. Creem is the merchant of record: the invoice
            documents themselves live in the customer portal, this is the store&apos;s ledger.
          </p>
        </div>
        <span className="workspace-index">SALES</span>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div>
            <span className="status-title">TRANSACTIONS</span>
            <p className="status-caption">Newest first, up to the last 200 movements.</p>
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
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col">Description</th>
                <th scope="col">Amount</th>
                <th scope="col">Refunded</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    No transactions yet. They arrive with the first completed checkout.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span className="wtable-date">{date(transaction.occurredAt)}</span>
                    </td>
                    <td>
                      <strong>{transaction.customer.email}</strong>
                    </td>
                    <td>
                      {transaction.description ?? transaction.type}
                      {transaction.periodEnd ? (
                        <small className="wreview-type"> · until {date(transaction.periodEnd)}</small>
                      ) : null}
                    </td>
                    <td>
                      <strong>{formatAmount(transaction.amountPaidCents ?? transaction.amountCents, transaction.currency)}</strong>
                    </td>
                    <td>
                      {transaction.refundedCents ? (
                        <span className="wtable-date">{formatAmount(transaction.refundedCents, transaction.currency)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={BADGES[transaction.status] ?? "wbadge wbadge-user"}>{transaction.status}</span>
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
