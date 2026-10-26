import { notFound } from "next/navigation";
import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { panelStore } from "@/lib/panel-store";
import { loadStoreTicket } from "@/lib/support";
import { setTicketStatusAction } from "../_actions";
import StaffReply from "../_components/staff-reply";

export const dynamic = "force-dynamic";

const date = (value: Date) => value.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** One support conversation with reply, close and reopen. */
export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const ticket = await loadStoreTicket(storeId, (await params).id);
  if (!ticket) notFound();
  const closed = ticket.status === "closed";

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> SUPPORT / REQUEST
      </div>
      <div className="workspace-intro">
        <div>
          <h1>{ticket.subject}</h1>
          <p>
            {ticket.user.name} · <a href={`mailto:${ticket.user.email}`}>{ticket.user.email}</a>
            {ticket.product ? ` · ${ticket.product.name}` : ""} · opened {date(ticket.createdAt)}
          </p>
        </div>
        <div className="wsupport-actions">
          <Link className="wbtn wbtn-ghost" href="/panel/support">
            All requests
          </Link>
          <form action={setTicketStatusAction.bind(null, ticket.id, closed ? "open" : "closed")}>
            <button className="wbtn" type="submit">
              {closed ? "Reopen" : "Close request"}
            </button>
          </form>
        </div>
      </div>

      <div className="wform-card">
        <ol className="wsupport-thread">
          {ticket.messages.map((message) => (
            <li key={message.id} data-staff={message.fromStaff}>
              <header>
                <strong>{message.fromStaff ? `${message.author?.name ?? "Team"} (team)` : ticket.user.name}</strong>
                <time dateTime={message.createdAt.toISOString()}>{date(message.createdAt)}</time>
              </header>
              <p>{message.body}</p>
            </li>
          ))}
        </ol>
        <StaffReply ticketId={ticket.id} />
      </div>
    </>
  );
}
