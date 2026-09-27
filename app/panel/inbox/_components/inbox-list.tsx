"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInquiryArchived, setInquiryRead } from "../_actions";
import { formatInquiryDate, type InquiryRow } from "../_lib";

type Tab = "inbox" | "archived";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Fixed header and footer, scrollable body: the message is the only scrolling part. */
function InquiryDialog({
  inquiry,
  busy,
  error,
  onClose,
  onToggleRead,
  onToggleArchived,
}: {
  inquiry: InquiryRow;
  busy: boolean;
  error: string;
  onClose: () => void;
  onToggleRead: (inquiry: InquiryRow) => void;
  onToggleArchived: (inquiry: InquiryRow) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (inquiry && !dialog.open) dialog.showModal();
    if (!inquiry && dialog.open) dialog.close();
  }, [inquiry]);

  const archived = inquiry.archivedAt !== null;

  return (
    <dialog ref={ref} className="wdialog wdialog-wide" onClose={onClose} onCancel={onClose}>
      <header className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Contact request</span>
          <h2 id="wdialog-title">{inquiry.name}</h2>
        </div>
        <button className="wdialog-close" type="button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="wdialog-body">
        <div className="winbox-meta">
          <div>
            <span>E-mail</span>
            <strong>{inquiry.email}</strong>
          </div>
          <div>
            <span>Agency</span>
            <strong>{inquiry.agency}</strong>
          </div>
          <div>
            <span>TYPO3</span>
            <strong>{inquiry.typo3Version}</strong>
          </div>
          <div>
            <span>License</span>
            <strong>{inquiry.license}</strong>
          </div>
          <div>
            <span>Received</span>
            <strong>{formatInquiryDate(inquiry.createdAt)}</strong>
          </div>
        </div>

        <p className="winbox-badges">
          <span className={`wbadge ${inquiry.readAt ? "wbadge-verified" : "wbadge-pending"}`}>
            {inquiry.readAt ? "read" : "new"}
          </span>
          <span className={`wbadge ${inquiry.emailSent ? "wbadge-verified" : "wbadge-missing"}`}>
            {inquiry.emailSent ? "notification e-mail sent" : "notification e-mail failed"}
          </span>
        </p>

        <blockquote className="winbox-message">{inquiry.message}</blockquote>

        {error ? (
          <p className="wdialog-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="wdialog-foot">
        <button
          className="wbtn wbtn-ghost"
          type="button"
          disabled={busy}
          onClick={() => onToggleRead(inquiry)}
        >
          {inquiry.readAt ? "Mark unread" : "Mark read"}
        </button>
        <button
          className="wbtn wbtn-ghost wbtn-danger-ghost"
          type="button"
          disabled={busy}
          onClick={() => onToggleArchived(inquiry)}
        >
          {archived ? "Restore to inbox" : "Archive"}
        </button>
        <a
          className="wbtn wbtn-primary"
          href={`mailto:${inquiry.email}?subject=${encodeURIComponent("Re: your CMSMotive inquiry")}`}
        >
          Reply by e-mail
        </a>
      </footer>
    </dialog>
  );
}

export default function InboxList({ rows, limit }: { rows: InquiryRow[]; limit: number }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [tab, setTab] = useState<Tab>("inbox");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<InquiryRow | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Server refreshes (router.refresh after every action) replace the prop list.
  useEffect(() => setItems(rows), [rows]);

  const queryLower = query.trim().toLowerCase();
  const visible = items.filter((row) => {
    if (tab === "inbox" ? row.archivedAt !== null : row.archivedAt === null) return false;
    if (!queryLower) return true;
    return [row.name, row.email, row.agency, row.message].some((field) => field.toLowerCase().includes(queryLower));
  });

  const inboxCount = items.filter((row) => row.archivedAt === null).length;
  const archivedCount = items.length - inboxCount;

  function patchRow(id: string, patch: Partial<Pick<InquiryRow, "readAt" | "archivedAt">>) {
    setItems((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    if (active?.id === id) setActive((current) => (current ? { ...current, ...patch } : current));
  }

  function run(id: string, action: Promise<{ ok: true } | { ok: false; error: string }>, patch: Partial<InquiryRow>) {
    setPendingId(id);
    setDialogError("");
    startTransition(async () => {
      const result = await action;
      setPendingId(null);
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      patchRow(id, patch);
      // Keeps the sidebar unread badge and notification menu in sync.
      router.refresh();
    });
  }

  const toggleRead = (inquiry: InquiryRow) =>
    run(inquiry.id, setInquiryRead(inquiry.id, !inquiry.readAt), { readAt: inquiry.readAt ? null : new Date().toISOString() });

  const toggleArchived = (inquiry: InquiryRow) =>
    run(
      inquiry.id,
      setInquiryArchived(inquiry.id, inquiry.archivedAt === null),
      inquiry.archivedAt === null
        ? { archivedAt: new Date().toISOString(), readAt: inquiry.readAt ?? new Date().toISOString() }
        : { archivedAt: null },
    );

  /** Opening a message counts as reading it. */
  function open(inquiry: InquiryRow) {
    setActive(inquiry);
    setDialogError("");
    if (!inquiry.readAt) toggleRead(inquiry);
  }

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="winbox-tabs" role="tablist" aria-label="Message folders">
            <button
              className={`winbox-tab ${tab === "inbox" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={tab === "inbox"}
              onClick={() => setTab("inbox")}
            >
              Inbox <span className="winbox-tab-count">{inboxCount}</span>
            </button>
            <button
              className={`winbox-tab ${tab === "archived" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={tab === "archived"}
              onClick={() => setTab("archived")}
            >
              Archived <span className="winbox-tab-count">{archivedCount}</span>
            </button>
          </div>
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="w-inbox-search">
              Search messages
            </label>
            <input
              id="w-inbox-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, agency or message…"
            />
          </div>
        </div>

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Sender</th>
                <th scope="col">Project</th>
                <th scope="col">Received</th>
                <th scope="col">Status</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wtable-state">
                    {items.length === 0
                      ? "No contact messages yet."
                      : queryLower
                        ? "No messages match the current search."
                        : tab === "archived"
                          ? "Nothing archived yet."
                          : "The inbox is empty — everything has been archived."}
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const archived = row.archivedAt !== null;
                  return (
                    <tr key={row.id} className={row.readAt ? undefined : "winbox-new"}>
                      <td>
                        <div className="wtable-user">
                          <span className="wtable-avatar" aria-hidden="true">
                            {initials(row.name)}
                          </span>
                          <div>
                            <strong>{row.name}</strong>
                            <small>{row.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{row.agency}</strong>
                        <small className="winbox-project">
                          {row.typo3Version} · {row.license}
                        </small>
                      </td>
                      <td>
                        <span className="wtable-date">{formatInquiryDate(row.createdAt)}</span>
                      </td>
                      <td>
                        {archived ? (
                          <span className="wbadge wbadge-user">archived</span>
                        ) : row.readAt ? (
                          <span className="wbadge wbadge-verified">read</span>
                        ) : (
                          <span className="wbadge wbadge-pending">new</span>
                        )}
                      </td>
                      <td className="wtable-actions-col">
                        <div className="wtable-actions">
                          <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => open(row)}>
                            Open
                          </button>
                          <button
                            className="wbtn wbtn-ghost wbtn-sm wbtn-danger-ghost"
                            type="button"
                            disabled={pendingId === row.id}
                            onClick={() => toggleArchived(row)}
                          >
                            {archived ? "Restore" : "Archive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">
            {items.length >= limit
              ? `Showing the newest ${limit} messages`
              : visible.length === 1
                ? "1 message"
                : `${visible.length} messages`}
          </p>
        </div>
      </div>

      {active ? (
        <InquiryDialog
          inquiry={active}
          busy={pendingId === active.id}
          error={dialogError}
          onClose={() => setActive(null)}
          onToggleRead={toggleRead}
          onToggleArchived={toggleArchived}
        />
      ) : null}
    </>
  );
}
