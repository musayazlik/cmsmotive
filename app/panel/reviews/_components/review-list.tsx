"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import type { ReviewStatus } from "@/lib/reviews";
import ConfirmDialog from "../../_components/confirm-dialog";
import { Select, type SelectOption } from "../../_components/ui";
import { deleteReview, setReviewStatus } from "../_actions";
import { formatReviewDate, stars, type ActionResult, type ReviewRow } from "../_lib";

const TABS: { status: ReviewStatus; label: string }[] = [
  { status: "pending", label: "Awaiting approval" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

const BADGE: Record<ReviewStatus, string> = {
  pending: "wbadge-pending",
  approved: "wbadge-verified",
  rejected: "wbadge-missing",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="wreview-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {stars(rating)}
    </span>
  );
}

/** Moderation buttons for a review, minus the one matching its current status. */
function StatusButtons({
  review,
  busy,
  size = "",
  onStatus,
}: {
  review: ReviewRow;
  busy: boolean;
  size?: string;
  onStatus: (review: ReviewRow, status: ReviewStatus) => void;
}) {
  return (
    <>
      {review.status !== "approved" ? (
        <button className={`wbtn wbtn-primary ${size}`} type="button" disabled={busy} onClick={() => onStatus(review, "approved")}>
          Approve
        </button>
      ) : null}
      {review.status !== "rejected" ? (
        <button
          className={`wbtn wbtn-ghost wbtn-danger-ghost ${size}`}
          type="button"
          disabled={busy}
          onClick={() => onStatus(review, "rejected")}
        >
          Reject
        </button>
      ) : null}
      {review.status !== "pending" ? (
        <button className={`wbtn wbtn-ghost ${size}`} type="button" disabled={busy} onClick={() => onStatus(review, "pending")}>
          Back to pending
        </button>
      ) : null}
    </>
  );
}

function ReviewDialog({
  review,
  busy,
  error,
  onClose,
  onStatus,
  onDelete,
}: {
  review: ReviewRow;
  busy: boolean;
  error: string;
  onClose: () => void;
  onStatus: (review: ReviewRow, status: ReviewStatus) => void;
  onDelete: (review: ReviewRow) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={ref} className="wdialog wdialog-wide" onClose={onClose} onCancel={onClose} aria-labelledby="wreview-title">
      <header className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Review · {review.productName}</span>
          <h2 id="wreview-title">{review.authorName}</h2>
        </div>
        <button className="wdialog-close" type="button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="wdialog-body">
        <div className="winbox-meta">
          <div>
            <span>E-mail (private)</span>
            <strong>{review.authorEmail}</strong>
          </div>
          <div>
            <span>Product</span>
            <strong>
              <a href={review.productPath} target="_blank" rel="noreferrer">
                {review.productName} ↗
              </a>
            </strong>
          </div>
          <div>
            <span>Rating</span>
            <strong>
              <Stars rating={review.rating} /> {review.rating}/5
            </strong>
          </div>
          <div>
            <span>Language</span>
            <strong>{review.locale.toUpperCase()}</strong>
          </div>
          <div>
            <span>Received</span>
            <strong>{formatReviewDate(review.createdAt)}</strong>
          </div>
        </div>

        <p className="winbox-badges">
          <span className={`wbadge ${BADGE[review.status]}`}>{review.status}</span>
          {review.moderatedAt ? <span className="wbadge wbadge-user">moderated {formatReviewDate(review.moderatedAt)}</span> : null}
        </p>

        <blockquote className="winbox-message">{review.body}</blockquote>

        {error ? (
          <p className="wdialog-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="wdialog-foot">
        <button className="wbtn wbtn-ghost wbtn-danger-ghost" type="button" disabled={busy} onClick={() => onDelete(review)}>
          Delete
        </button>
        <StatusButtons review={review} busy={busy} onStatus={onStatus} />
      </footer>
    </dialog>
  );
}

/**
 * Product filter options: one product type, every theme and extension, and
 * reviews whose product has since been deleted.
 */
function productOptions(rows: ReviewRow[], products: SelectOption[]): SelectOption[] {
  const removed = new Map<string, SelectOption>();
  for (const row of rows) {
    if (row.productType === null) removed.set(row.productKey, { value: row.productKey, label: `Removed · ${row.productName}` });
  }
  return [
    { value: "type:theme", label: "All themes" },
    { value: "type:extension", label: "All extensions" },
    ...products,
    ...removed.values(),
  ];
}

type Props = {
  rows: ReviewRow[];
  limit: number;
  /** Every theme and extension, so the filter also offers products without reviews yet. */
  products: SelectOption[];
  initialProduct?: string;
};

export default function ReviewList({ rows, limit, products, initialProduct = "" }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState(initialProduct);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Server refreshes (router.refresh after every action) replace the prop list.
  useEffect(() => setItems(rows), [rows]);

  const active = items.find((row) => row.id === activeId) ?? null;
  const confirming = items.find((row) => row.id === confirmId) ?? null;

  const queryLower = query.trim().toLowerCase();
  const matchesProduct = (row: ReviewRow) =>
    !product ||
    (product === "type:theme" ? row.productType === "theme" : product === "type:extension" ? row.productType === "extension" : row.productKey === product);
  const visible = items.filter((row) => {
    if (row.status !== tab || !matchesProduct(row)) return false;
    if (!queryLower) return true;
    return [row.authorName, row.authorEmail, row.productName, row.body].some((field) => field.toLowerCase().includes(queryLower));
  });
  const counts = Object.fromEntries(
    TABS.map(({ status }) => [status, items.filter((row) => row.status === status && matchesProduct(row)).length]),
  );
  const options = productOptions(items, products);

  function run(id: string, action: Promise<ActionResult>, onSuccess: () => void) {
    setPendingId(id);
    setError("");
    startTransition(async () => {
      const result = await action;
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
      // Keeps the sidebar pending badge in sync.
      router.refresh();
    });
  }

  const changeStatus = (review: ReviewRow, status: ReviewStatus) =>
    run(review.id, setReviewStatus(review.id, status), () =>
      setItems((current) =>
        current.map((row) =>
          row.id === review.id ? { ...row, status, moderatedAt: status === "pending" ? null : new Date().toISOString() } : row,
        ),
      ),
    );

  const remove = (review: ReviewRow) =>
    run(review.id, deleteReview(review.id), () => {
      setItems((current) => current.filter((row) => row.id !== review.id));
      setConfirmId(null);
      setActiveId(null);
    });

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="winbox-tabs" role="tablist" aria-label="Review status">
            {TABS.map(({ status, label }) => (
              <button
                key={status}
                className={`winbox-tab ${tab === status ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={tab === status}
                onClick={() => setTab(status)}
              >
                {label} <span className="winbox-tab-count">{counts[status]}</span>
              </button>
            ))}
          </div>
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="w-review-search">
              Search reviews
            </label>
            <input
              id="w-review-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, e-mail, product or text…"
            />
          </div>
          <div className="wtable-filters">
            <Select
              label="Product"
              hideLabel
              placeholder="All products"
              emptyLabel="All products"
              value={product}
              onChange={setProduct}
              options={options}
            />
          </div>
        </div>

        {error && !active ? (
          <p className="wtable-state wtable-state-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">Reviewer</th>
                <th scope="col">Product</th>
                <th scope="col">Review</th>
                <th scope="col">Received</th>
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
                      ? "No reviews yet."
                      : queryLower
                        ? "No reviews match the current search."
                        : tab === "pending"
                          ? "Nothing waiting — every review has been handled."
                          : `No ${tab} reviews.`}
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id} className={row.status === "pending" ? "winbox-new" : undefined}>
                    <td>
                      <div className="wtable-user">
                        <span className="wtable-avatar" aria-hidden="true">
                          {initials(row.authorName)}
                        </span>
                        <div>
                          <strong>{row.authorName}</strong>
                          <small>{row.authorEmail}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{row.productName}</strong>
                      <small className="wreview-type">{row.productType === "extension" ? "Extension" : row.productType === "theme" ? "Theme" : "Removed product"}</small>
                      <small className="winbox-project">
                        <Stars rating={row.rating} />
                      </small>
                    </td>
                    <td>
                      <p className="wreview-excerpt">{row.body}</p>
                    </td>
                    <td>
                      <span className="wtable-date">{formatReviewDate(row.createdAt)}</span>
                    </td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setActiveId(row.id)}>
                          Open
                        </button>
                        <StatusButtons review={row} busy={pendingId === row.id} size="wbtn-sm" onStatus={changeStatus} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">
            {items.length >= limit
              ? `Showing the newest ${limit} reviews`
              : visible.length === 1
                ? "1 review"
                : `${visible.length} reviews`}
          </p>
        </div>
      </div>

      {active ? (
        <ReviewDialog
          review={active}
          busy={pendingId === active.id}
          error={error}
          onClose={() => {
            setActiveId(null);
            setError("");
          }}
          onStatus={changeStatus}
          onDelete={(review) => setConfirmId(review.id)}
        />
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title="Delete this review?"
        body="The review is removed permanently. Rejecting it instead keeps it on record without showing it."
        busy={confirming !== null && pendingId === confirming.id}
        onConfirm={() => confirming && remove(confirming)}
        onClose={() => setConfirmId(null)}
      />
    </>
  );
}
