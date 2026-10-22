"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CommentCopy, PublicComment, PublicComments } from "@/lib/blog-comments-shared";
import { COMMENT_LIMITS } from "@/lib/blog-comments-shared";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";

type Props = { postId: string; locale: Locale; initial: PublicComments; copy: CommentCopy; preview: boolean };

export default function BlogComments({ postId, locale, initial, copy, preview }: Props) {
  const [data, setData] = useState(initial);
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const requestKey = useRef<string | null>(null);
  const t = (key: keyof CommentCopy, vars?: Record<string, string>) => copy[key].replace(/\{(\w+)\}/g, (match, name: string) => vars?.[name] ?? match);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setStatus(null);
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/blog-comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, parentId: reply?.id, name: values.get("name"), email: values.get("email"), body: values.get("body"), website: values.get("website"), locale, requestKey: requestKey.current }) });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const message = result.code === "invalid" ? t("Please check your name, email and comment.") : result.code === "rate-limit" ? t("Please wait before posting another comment.") : result.code === "unavailable" ? t("This article or comment is no longer available.") : t("Your comment could not be saved. Please try again.");
        setStatus({ message, error: true });
        return;
      }
      if (messageRef.current) messageRef.current.value = "";
      requestKey.current = null;
      setReply(null);
      setStatus({ message: t("Your comment has been sent. It will be published after AI review and administrator approval."), error: false });
    } catch {
      setStatus({ message: t("Your comment could not be saved. Please try again."), error: true });
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (loading || !data.nextCursor) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/blog-comments?${new URLSearchParams({ postId, cursor: data.nextCursor })}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const next = await response.json() as PublicComments;
      setData((current) => ({ ...next, comments: [...current.comments, ...next.comments.filter((item) => !current.comments.some((existing) => existing.id === item.id))] }));
    } catch {
      setStatus({ message: t("Comments could not be loaded. Please try again."), error: true });
    } finally { setLoading(false); }
  }

  function comment(item: PublicComment, canReply: boolean) {
    return (
      <div className="comment-top" id={`comment-${item.id}`}>
        <span className="comment-avatar" aria-hidden="true">{item.authorName.charAt(0).toUpperCase()}</span>
        <div className="comment-content">
          <div className="comment-byline"><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time></div>
          <p>{item.body}</p>
          {canReply && <button className="comment-reply-button" type="button" disabled={pending} aria-label={t("Reply to {name}", { name: item.authorName })} onClick={() => { setReply({ id: item.id, name: item.authorName }); requestKey.current = null; messageRef.current?.focus(); }}>{t("Reply")}</button>}
        </div>
      </div>
    );
  }

  return (
    <section className="comments-section blog-comments" aria-labelledby="comments-title">
      <div className="comments-heading"><div><span className="eyebrow">{t("The conversation")}</span><h2 id="comments-title">{t("Comments")} <span>{data.count}</span></h2></div><p>{t("Share a thought or continue a thread.")}</p></div>
      {preview ? <p className="comment-empty">{t("Comments will open when this article is published.")}</p> : <>
        <div className="comment-list">
          {data.comments.length === 0 && <p className="comment-empty">{t("No comments yet. Start the conversation.")}</p>}
          {data.comments.map((item) => <article className="comment-thread" key={item.id}>{comment(item, true)}{item.replies.length > 0 && <div className="comment-replies">{item.replies.map((child) => <div key={child.id}>{comment(child, false)}</div>)}</div>}</article>)}
        </div>
        {data.nextCursor && <button type="button" className="comment-reply-button" onClick={loadMore} disabled={loading}>{loading ? t("Loading comments…") : t("Load more comments")}</button>}
        <div className="comment-composer">
          <h3>{reply ? t("Reply to {name}", { name: reply.name }) : t("Leave a comment")}</h3>
          <p id="comment-privacy">{t("Comments appear after approval. Your email address is never shown.")}</p>
          {reply && <button type="button" className="comment-reply-button" disabled={pending} onClick={() => { setReply(null); requestKey.current = null; }}>{t("Cancel")}</button>}
          <form className="comment-form" onSubmit={submit} onChange={() => { requestKey.current = null; if (status && !status.error) setStatus(null); }} aria-busy={pending}>
            <div className="comment-identity">
              <div className="comment-field"><label htmlFor="comment-name">{t("Your name")}</label><input id="comment-name" name="name" autoComplete="name" required minLength={COMMENT_LIMITS.nameMin} maxLength={COMMENT_LIMITS.nameMax} disabled={pending} /></div>
              <div className="comment-field"><label htmlFor="comment-email">{t("Email address")}</label><input id="comment-email" name="email" type="email" autoComplete="email" required maxLength={COMMENT_LIMITS.emailMax} aria-describedby="comment-privacy" disabled={pending} /></div>
            </div>
            <div className="comment-honeypot" aria-hidden="true"><label htmlFor="comment-website">Website</label><input id="comment-website" name="website" tabIndex={-1} autoComplete="off" /></div>
            <div className="comment-field"><label htmlFor="comment-message">{t("Your comment")}</label><textarea ref={messageRef} id="comment-message" name="body" rows={5} required minLength={COMMENT_LIMITS.bodyMin} maxLength={COMMENT_LIMITS.bodyMax} disabled={pending} /></div>
            <div className={`comment-status${status?.error ? " is-error" : ""}`} role="status" aria-live="polite">
              {status && <><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" />{status.error ? <path d="M12 7v6m0 4h.01" /> : <path d="m8 12 3 3 5-6" />}</svg><p>{status.message}</p></>}
            </div>
            <div className="comment-form-bottom"><span>{t("Be thoughtful and constructive.")}</span><button className="btn btn-primary comment-submit" type="submit" disabled={pending}><span className="btn-label">{pending ? t("Sending comment…") : t("Post comment")}</span><svg className={pending ? "comment-submit-spinner" : ""} viewBox="0 0 24 24" aria-hidden="true">{pending ? <circle cx="12" cy="12" r="8" /> : <><path d="m21 3-7 18-4-7-7-4 18-7Z" /><path d="m10 14 5-5" /></>}</svg></button></div>
          </form>
        </div>
      </>}
    </section>
  );
}
