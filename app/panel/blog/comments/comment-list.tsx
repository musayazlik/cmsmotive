"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link, { useRouter } from "@/app/panel/_components/panel-navigation";
import Select from "@/app/panel/_components/ui/select";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";
import RowActions from "@/app/panel/_components/row-actions";
import { showAccountToast } from "@/public/assets/js/account-feedback.js";
import type { CommentStatus } from "@/lib/blog-comments-shared";
import { deleteComment, moderateComment, recheckComment } from "./_actions";

type Row = { id: string; authorName: string; authorEmail: string; body: string; status: string; locale: string; createdAt: string; post: { id: string; title: string; slug: string }; replyTo: string | null; replies: number; aiStatus: string; aiNote: string | null; aiModel: string | null; aiCheckedAt: string | null };
type Status = CommentStatus | "all";
type Props = { rows: Row[]; counts: Record<Status, number>; status: string; query: string; postId: string; posts: { id: string; title: string }[]; page: number; pageCount: number; total: number };
const tabs: { value: Status; label: string }[] = [{ value: "pending", label: "Awaiting approval" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All comments" }];
const badges: Record<string, string> = { pending: "wbadge-pending", approved: "wbadge-verified", rejected: "wbadge-missing" };
const aiLabels: Record<string, string> = { pending: "Queued", checking: "Checking…", passed: "No issues found", flagged: "Needs attention", error: "Check failed", unavailable: "Unavailable", not_checked: "Not checked" };
const aiBadges: Record<string, string> = { passed: "wbadge-verified", flagged: "wbadge-missing", error: "wbadge-missing", pending: "wbadge-pending", checking: "wbadge-pending" };

export default function CommentList({ rows, counts, status, query, postId, posts, page, pageCount, total }: Props) {
  const router = useRouter();
  const [post, setPost] = useState(postId);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();

  // Refresh only while recent background reviews are in flight, and stop if a worker was interrupted.
  useEffect(() => {
    const inFlight = () => rows.some((row) => (row.aiStatus === "checking" || row.aiStatus === "pending") && Date.now() - new Date(row.aiCheckedAt ?? row.createdAt).getTime() < 90_000);
    if (!inFlight()) return;
    const timer = window.setInterval(() => {
      if (!inFlight()) { window.clearInterval(timer); return; }
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [rows, router]);

  function href(changes: { status?: string; q?: string; post?: string; page?: number } = {}) {
    const params = new URLSearchParams({ status: changes.status ?? status });
    const q = changes.q ?? query;
    const targetPost = changes.post ?? postId;
    if (q) params.set("q", q);
    if (targetPost) params.set("post", targetPost);
    if ((changes.page ?? 1) > 1) params.set("page", String(changes.page));
    return `/panel/blog/comments?${params}`;
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    router.push(href({ q: String(values.get("q") ?? "").trim(), post }));
  }

  function run(row: Row, nextStatus?: CommentStatus | "ai") {
    startTransition(async () => {
      try {
        const result = nextStatus === "ai" ? await recheckComment(row.id) : nextStatus ? await moderateComment(row.id, nextStatus) : await deleteComment(row.id);
        if (!result.ok) { showAccountToast(result.error); return; }
        setConfirm(null);
        showAccountToast(nextStatus === "ai" ? "AI review updated." : nextStatus ? `Comment ${nextStatus === "pending" ? "returned to pending" : nextStatus}.` : "Comment deleted.", "success");
        router.refresh();
      } catch {
        showAccountToast("The comment could not be saved. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar wcomment-toolbar">
          <nav className="winbox-tabs" aria-label="Comment status">
            {tabs.map((tab) => <Link key={tab.value} className={`winbox-tab${status === tab.value ? " active" : ""}`} href={href({ status: tab.value })} aria-current={status === tab.value ? "page" : undefined}>{tab.label}<span className="winbox-tab-count">{counts[tab.value]}</span></Link>)}
          </nav>
          <form className="wcomment-filters" onSubmit={filter} role="search" aria-label="Filter blog comments">
            <div className="wtable-search"><label className="visually-hidden" htmlFor="comment-search">Search comments</label><input id="comment-search" type="search" name="q" defaultValue={query} maxLength={200} placeholder="Search name, email or comment…" /></div>
            <Select label="Filter by article" hideLabel value={post} onChange={setPost} placeholder="All articles" emptyLabel="All articles" options={posts.map((item) => ({ value: item.id, label: item.title }))} />
            <button type="submit" className="wbtn wbtn-ghost wbtn-sm">Filter</button>
            {(query || postId) && <Link className="wbtn wbtn-ghost wbtn-sm" href={`/panel/blog/comments?status=${status}`}>Clear</Link>}
          </form>
        </div>
        <div className="wtable-scroll">
          <table className="wtable wcomment-table">
            <thead><tr><th scope="col">Author</th><th scope="col">Comment</th><th scope="col">AI review</th><th scope="col">Article</th><th scope="col">Received</th><th scope="col" className="wtable-actions-col"><span className="visually-hidden">Moderation actions</span></th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={6} className="wtable-state">{query || postId ? "No comments match these filters." : status === "pending" ? "No comments awaiting approval." : "No comments here yet."}</td></tr> : rows.map((row) => (
                <tr key={row.id} className={row.status === "pending" ? "winbox-new" : undefined}>
                  <td><div className="wtable-user"><span className="wtable-avatar" aria-hidden="true">{row.authorName.charAt(0).toUpperCase()}</span><div><strong>{row.authorName}</strong><small>{row.authorEmail}</small></div></div></td>
                  <td>
                    {row.replyTo && <small className="wcomment-reply">Reply to {row.replyTo}</small>}
                    {row.body.length > 180 ? <details className="wcomment-message"><summary><span className="wcomment-preview">{row.body.slice(0, 180)}…</span><span className="wcomment-collapse">Show less</span></summary><p>{row.body}</p></details> : <p className="wcomment-message">{row.body}</p>}
                    <span className={`wbadge ${badges[row.status] ?? "wbadge-pending"}`}>{row.status}</span>
                    {row.replies > 0 && <small className="wcomment-reply">{row.replies} {row.replies === 1 ? "reply" : "replies"}</small>}
                  </td>
                  <td><div className="wcomment-ai"><span className={`wbadge ${aiBadges[row.aiStatus] ?? "wbadge-neutral"}`}>{aiLabels[row.aiStatus] ?? "Not checked"}</span><p>{row.aiNote || (row.aiStatus === "checking" ? "AI is reviewing this comment. Administrator approval is still required." : "Waiting for AI review. You can run a check from the actions menu.")}</p>{row.aiModel && <small title={row.aiCheckedAt ? `Last check: ${new Date(row.aiCheckedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : undefined}>{row.aiModel}</small>}</div></td>
                  <td><Link className="wcomment-post" href={`/panel/blog/${row.post.id}`}>{row.post.title}</Link></td>
                  <td><time className="wtable-date" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</time><small className="wcomment-reply">{row.locale.toUpperCase()}</small></td>
                  <td className="wtable-actions-col"><RowActions label={`comment by ${row.authorName}`} actions={[
                    ...(row.status !== "approved" ? [{ label: "Approve", disabled: pending, onSelect: () => run(row, "approved") }] : []),
                    ...(row.status !== "rejected" ? [{ label: "Reject", disabled: pending, onSelect: () => run(row, "rejected") }] : []),
                    ...(row.status !== "pending" ? [{ label: "Back to pending", disabled: pending, onSelect: () => run(row, "pending") }] : []),
                    { label: "Run AI review", separated: true, disabled: pending, onSelect: () => run(row, "ai") },
                    { label: "Delete", separated: true, danger: true, disabled: pending, onSelect: () => setConfirm(row) },
                  ]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wtable-foot"><p className="wtable-count">{total} {total === 1 ? "comment" : "comments"} · Page {page} of {pageCount}</p><nav className="wtable-actions" aria-label="Comments pagination">{page > 1 && <Link className="wbtn wbtn-ghost wbtn-sm" href={href({ page: page - 1 })}>Previous</Link>}{page < pageCount && <Link className="wbtn wbtn-ghost wbtn-sm" href={href({ page: page + 1 })}>Next</Link>}</nav></div>
      </div>
      <ConfirmDialog open={confirm !== null} title="Delete this comment?" body={confirm?.replies ? "This permanently removes the comment and its replies. Reject it to keep the discussion on record." : "This permanently removes the comment. Reject it to keep it on record without publishing it."} busy={pending} onClose={() => { if (!pending) setConfirm(null); }} onConfirm={() => confirm && run(confirm)} />
    </>
  );
}
