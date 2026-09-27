import { prisma } from "@/lib/prisma";
import InboxList from "./_components/inbox-list";
import type { InquiryRow } from "./_lib";

export const dynamic = "force-dynamic";

/** Safety ceiling so an unexpected backlog cannot stall the panel. */
const INBOX_LIMIT = 500;

export default async function InboxPage() {
  const inquiries = await prisma.contactInquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: INBOX_LIMIT,
  });

  const rows: InquiryRow[] = inquiries.map((inquiry) => ({
    id: inquiry.id,
    name: inquiry.name,
    email: inquiry.email,
    agency: inquiry.agency,
    typo3Version: inquiry.typo3Version,
    license: inquiry.license,
    message: inquiry.message,
    emailSent: inquiry.emailSent,
    readAt: inquiry.readAt?.toISOString() ?? null,
    archivedAt: inquiry.archivedAt?.toISOString() ?? null,
    createdAt: inquiry.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> INBOX / CONTACT MESSAGES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Messages in <em>one place.</em>
          </h1>
          <p>
            Every submission from the contact form, newest first. Open a message to read it, reply by
            e-mail and archive what is handled — nothing is ever deleted.
          </p>
        </div>
        <span className="workspace-index">INBOX</span>
      </div>

      <InboxList rows={rows} limit={INBOX_LIMIT} />
    </>
  );
}
