import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

const date = (value: Date) => value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The store's buyers as Creem knows them, one row per store and Creem
 * customer and payment mode. A customer survives the deletion of its user
 * account, so financial history stays intact.
 */
export default async function CustomersPage() {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const customers = await prisma.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { orders: true, subscriptions: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SALES / CUSTOMERS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Every <em>customer.</em>
          </h1>
          <p>
            The buyers of this store as Creem knows them. Test and live payments create separate records; an account
            is linked when the customer checked out while signed in.
          </p>
        </div>
        <span className="workspace-index">SALES</span>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div>
            <span className="status-title">CUSTOMERS</span>
            <p className="status-caption">Newest first, up to the last 200 records.</p>
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
                <th scope="col">Country</th>
                <th scope="col">Environment</th>
                <th scope="col">Orders</th>
                <th scope="col">Subscriptions</th>
                <th scope="col">Customer since</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    No customers yet. A record is created with the first completed checkout.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name || customer.email}</strong>
                      <small>{customer.email}</small>
                    </td>
                    <td>
                      <span className="wtable-date">{customer.country ?? "—"}</span>
                    </td>
                    <td>
                      <span className={`wbadge ${customer.mode === "prod" ? "wbadge-verified" : "wbadge-user"}`}>{customer.mode}</span>
                    </td>
                    <td>{customer._count.orders}</td>
                    <td>{customer._count.subscriptions}</td>
                    <td>
                      <span className="wtable-date">{date(customer.createdAt)}</span>
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
