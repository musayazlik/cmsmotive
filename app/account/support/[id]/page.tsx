import { notFound } from "next/navigation";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { markNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { loadCustomerTicket } from "@/lib/support";
import { AccountHeading } from "../../account-ui";
import { supportStatusLabel } from "../status-label";
import { ReplyForm } from "../support-forms";

/** One support conversation. Opening it marks the reply notifications that point here as read. */
export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, l, storeId, { id }] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId(), params]);
  const ticket = await loadCustomerTicket(user.id, storeId, id);
  if (!ticket) notFound();
  const unread = await prisma.notification.findMany({
    where: { userId: user.id, storeId, readAt: null, href: `/account/support/${ticket.id}` },
    select: { id: true },
  });
  if (unread.length) await markNotificationsRead(user.id, storeId, unread.map((row) => row.id));
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <AccountHeading
        title={ticket.subject}
        description={`${ticket.product?.name ?? copy(l, "General question", "Allgemeine Frage", "Genel soru")} · ${supportStatusLabel(ticket.status, l)}`}
        action={
          <a className="wbtn wbtn-ghost" href={`/account/support?lang=${l}`}>
            {copy(l, "All requests", "Alle Anfragen", "Tüm talepler")}
          </a>
        }
      />
      <section className="customer-card" aria-label={copy(l, "Conversation", "Verlauf", "Yazışma")}>
        <ol className="customer-thread">
          {ticket.messages.map((message) => (
            <li key={message.id} data-staff={message.fromStaff}>
              <header>
                <strong>
                  {message.fromStaff ? copy(l, "CMSMotive team", "CMSMotive-Team", "CMSMotive ekibi") : copy(l, "You", "Sie", "Siz")}
                </strong>
                <time dateTime={message.createdAt.toISOString()}>{date.format(message.createdAt)}</time>
              </header>
              <p>{message.body}</p>
            </li>
          ))}
        </ol>
        <div className="customer-card-body">
          <ReplyForm ticketId={ticket.id} closed={ticket.status === "closed"} locale={l} />
        </div>
      </section>
    </>
  );
}
