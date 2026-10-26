import Link from "next/link";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { listCustomerTickets, supportProducts } from "@/lib/support";
import { AccountEmpty, AccountHeading, AccountIcon } from "../account-ui";
import { supportStatusLabel } from "./status-label";
import { NewTicketForm } from "./support-forms";

/** The customer's support requests in this store, and a form to open a new one. */
export default async function SupportPage() {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const [tickets, products] = await Promise.all([listCustomerTickets(user.id, storeId), supportProducts(user.id, storeId)]);
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <AccountHeading
        title={copy(l, "Support", "Support", "Destek")}
        description={copy(
          l,
          "Ask about installation, updates, licences or your purchase. We answer here and let you know by email.",
          "Fragen zu Installation, Updates, Lizenzen oder Ihrem Kauf. Wir antworten hier und informieren Sie per E-Mail.",
          "Kurulum, güncellemeler, lisanslar veya satın alımınızla ilgili sorun. Burada yanıtlar, e-postayla haber veririz.",
        )}
      />
      <div className="customer-columns">
        <div className="customer-stack">
          <section className="customer-card" aria-labelledby="tickets-title">
            <header className="customer-card-head">
              <h2 id="tickets-title">{copy(l, "Your requests", "Ihre Anfragen", "Talepleriniz")}</h2>
              <span className="customer-count">{tickets.length}</span>
            </header>
            {tickets.length ? (
              <ul className="customer-records">
                {tickets.map((ticket) => (
                  <li className="customer-record" key={ticket.id}>
                    <div>
                      <strong>
                        <Link href={`/account/support/${ticket.id}?lang=${l}`}>{ticket.subject}</Link>
                      </strong>
                      <p>
                        {ticket.product?.name ?? copy(l, "General question", "Allgemeine Frage", "Genel soru")} · {ticket._count.messages}{" "}
                        {copy(l, "messages", "Nachrichten", "mesaj")} · {date.format(ticket.lastMessageAt)}
                      </p>
                    </div>
                    <span className="customer-status" data-positive={ticket.status === "answered"}>
                      {supportStatusLabel(ticket.status, l)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <AccountEmpty
                icon="support"
                title={copy(l, "No requests yet", "Noch keine Anfragen", "Henüz talep yok")}
                description={copy(l, "Your conversations with our team will be listed here.", "Ihre Gespräche mit unserem Team erscheinen hier.", "Ekibimizle yazışmalarınız burada listelenir.")}
              />
            )}
          </section>
        </div>
        <aside className="customer-stack" aria-label={copy(l, "New request", "Neue Anfrage", "Yeni talep")}>
          <section className="customer-card" aria-labelledby="new-ticket-title">
            <header className="customer-card-head">
              <h2 id="new-ticket-title">{copy(l, "New request", "Neue Anfrage", "Yeni talep")}</h2>
              <AccountIcon name="support" className="customer-heading-icon" />
            </header>
            <div className="customer-card-body">
              <NewTicketForm products={products} locale={l} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
