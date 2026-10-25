import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { formatAmount } from "@/lib/prices";
import { prisma } from "@/lib/prisma";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  disputed: "Disputed",
};

const STATUS_BADGES: Record<string, string> = {
  paid: "wbadge wbadge-verified",
  refunded: "wbadge wbadge-missing",
  partially_refunded: "wbadge wbadge-pending",
  disputed: "wbadge wbadge-pending",
};

const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

/** Revenue is grouped per currency; the panel never converts or guesses rates. */
function revenueLine(rows: { currency: string; amountCents: number }[]) {
  if (rows.length === 0) return "—";
  return rows.map((row) => formatAmount(row.amountCents, row.currency)).join(" · ");
}

/** Every order of the store, newest first; `?product=` narrows it to one product (linked from its edit page). */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ product?: string; page?: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const { product, page } = await searchParams;
  const current = Math.max(1, Number(page) || 1);

  // The filter offers exactly the products the store owns or lists.
  const [products, revenue, orderCount, newSubscriptions] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ storeId }, { listings: { some: { storeId } } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.order.groupBy({ by: ["currency"], where: { storeId, status: "paid", placedAt: { gte: since } }, _sum: { amountCents: true } }),
    prisma.order.count({ where: { storeId, placedAt: { gte: since } } }),
    prisma.subscription.count({ where: { storeId, createdAt: { gte: since } } }),
  ]);
  const selected = product && products.some((entry) => entry.id === product) ? product : "";

  const where = { storeId, ...(selected ? { productId: selected } : {}) };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { email: true } },
        product: { select: { name: true, slug: true } },
        price: { select: { name: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = (next: number) =>
    `/panel/sales/orders?${new URLSearchParams({ ...(selected ? { product: selected } : {}), ...(next > 1 ? { page: String(next) } : {}) })}`;
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SALES / ORDERS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Every <em>order.</em>
          </h1>
          <p>Completed checkouts of this store, newest first. Refunds and disputes arrive through the Creem webhook.</p>
        </div>
        <span className="workspace-index">SALES</span>
      </div>

      <div className="status-grid status-grid-duo" aria-label="Sales figures">
        <article className="status-card" aria-labelledby="orders-revenue">
          <header className="status-head">
            <span className="status-title" id="orders-revenue">
              LAST 30 DAYS
            </span>
          </header>
          <div className="status-row">
            <span className="status-label">Revenue</span>
            <div className="status-value">
              <strong>{revenueLine(revenue.map((row) => ({ currency: row.currency, amountCents: row._sum.amountCents ?? 0 })))}</strong>
              <small>
                {orderCount} order{orderCount === 1 ? "" : "s"}
              </small>
            </div>
          </div>
        </article>
        <article className="status-card" aria-labelledby="orders-subscriptions">
          <header className="status-head">
            <span className="status-title" id="orders-subscriptions">
              NEW SUBSCRIPTIONS
            </span>
            <Link className="status-link" href="/panel/sales/subscriptions">
              Subscriptions ↗
            </Link>
          </header>
          <div className="status-row">
            <span className="status-label">Started</span>
            <div className="status-value">
              <strong>{newSubscriptions}</strong>
              <small>in the last 30 days</small>
            </div>
          </div>
        </article>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-filters">
            {products.map((entry) =>
              selected === entry.id ? (
                <Link key={entry.id} className="wbtn wbtn-primary wbtn-sm" href="/panel/sales/orders">
                  {entry.name} ×
                </Link>
              ) : (
                <Link key={entry.id} className="wbtn wbtn-ghost wbtn-sm" href={`/panel/sales/orders?product=${entry.id}`}>
                  {entry.name}
                </Link>
              ),
            )}
          </div>
        </div>
        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Placed</th>
                <th scope="col">Customer</th>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Amount</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="wtable-state">
                    {selected ? "No orders for this product yet." : "No orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="wtable-date">
                        {order.placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td>
                      <strong>{order.customer.email}</strong>
                    </td>
                    <td>{order.product.name}</td>
                    <td>{order.price.name}</td>
                    <td>
                      <strong>{formatAmount(order.amountCents, order.currency)}</strong>
                    </td>
                    <td>
                      <small className="wreview-type">{order.type === "recurring" ? "Subscription" : "One-time"}</small>
                    </td>
                    <td>
                      <span className={STATUS_BADGES[order.status] ?? "wbadge wbadge-user"}>{STATUS_LABELS[order.status] ?? order.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="wtable-foot">
          <p className="wtable-count">{total === 0 ? "No orders" : `${from}–${to} of ${total}`}</p>
          <nav className="wpager" aria-label="Pagination">
            <Link className="wbtn wbtn-ghost wbtn-sm" href={query(Math.max(1, current - 1))} aria-disabled={current <= 1}>
              ‹
            </Link>
            <span className="wpager-state">
              Page {current} / {totalPages}
            </span>
            <Link className="wbtn wbtn-ghost wbtn-sm" href={query(Math.min(totalPages, current + 1))} aria-disabled={current >= totalPages}>
              ›
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
