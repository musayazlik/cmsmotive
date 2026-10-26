import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { panelStore } from "@/lib/panel-store";
import { SUPPORT_STATUSES, listStoreTickets, type SupportStatus } from "@/lib/support";

export const dynamic = "force-dynamic";

const date = (value: Date) => value.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_BADGE: Record<string, string> = { open: "wbadge-pending", answered: "wbadge-verified", closed: "wbadge-user" };
const STATUS_LABEL: Record<string, string> = { open: "Waiting for us", answered: "Answered", closed: "Closed" };

/** Customers' support requests in this store, newest activity first. */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const query = await searchParams;
  const status = (SUPPORT_STATUSES as readonly string[]).includes(query.status ?? "") ? (query.status as SupportStatus) : undefined;
  const tickets = await listStoreTickets(storeId, status);

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SUPPORT
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Customer <em>support.</em>
          </h1>
          <p>
            Requests customers open in their account. Replies appear in the customer&apos;s account and are emailed to them; new
            customer messages are emailed to the store&apos;s contact inbox.
          </p>
        </div>
        <span className="workspace-index">SUPPORT</span>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div>
            <span className="status-title">REQUESTS</span>
            <p className="status-caption">Up to the last 200, most recent activity first.</p>
          </div>
          <div className="wtable-tools">
            {[undefined, ...SUPPORT_STATUSES].map((value) => (
              <Link key={value ?? "all"} className={`wbtn ${status === value ? "wbtn-primary" : "wbtn-ghost"}`} href={value ? `/panel/support?status=${value}` : "/panel/support"}>
                {value ? STATUS_LABEL[value] : "All"}
              </Link>
            ))}
          </div>
        </div>
        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Customer</th>
                <th scope="col">Product</th>
                <th scope="col">Status</th>
                <th scope="col">Messages</th>
                <th scope="col">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wtable-state">
                    No requests{status ? " with this status" : " yet"}.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link href={`/panel/support/${ticket.id}`}>
                        <strong>{ticket.subject}</strong>
                      </Link>
                    </td>
                    <td>
                      <strong>{ticket.user.name}</strong>
                      <small>{ticket.user.email}</small>
                    </td>
                    <td>{ticket.product?.name ?? "—"}</td>
                    <td>
                      <span className={`wbadge ${STATUS_BADGE[ticket.status] ?? "wbadge-user"}`}>{STATUS_LABEL[ticket.status] ?? ticket.status}</span>
                    </td>
                    <td>{ticket._count.messages}</td>
                    <td>
                      <span className="wtable-date">{date(ticket.lastMessageAt)}</span>
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
