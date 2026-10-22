/** Client-safe contracts and validation for moderated blog comments. */
export const COMMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export const COMMENT_LIMITS = { nameMin: 2, nameMax: 60, bodyMin: 2, bodyMax: 2000, emailMax: 254, perHour: 3 } as const;

export function isCommentStatus(value: unknown): value is CommentStatus {
  return typeof value === "string" && (COMMENT_STATUSES as readonly string[]).includes(value);
}

export type PublicComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};
export type PublicCommentThread = PublicComment & { replies: PublicComment[] };
export type PublicComments = { comments: PublicCommentThread[]; count: number; nextCursor: string | null };

export const COMMENT_COPY_KEYS = [
  "Your comment has been sent. It will be published after AI review and administrator approval.",
  "The conversation", "Comments", "Share a thought or continue a thread.", "Leave a comment", "Your name", "Email address", "Your comment", "Post comment", "Be thoughtful and constructive.", "Reply", "Reply to {name}", "Cancel", "No comments yet. Start the conversation.", "Load more comments", "Loading comments…", "Sending comment…", "Your comment has been submitted for approval.", "Comments appear after approval. Your email address is never shown.", "Please check your name, email and comment.", "Please wait before posting another comment.", "This article or comment is no longer available.", "Your comment could not be saved. Please try again.", "Comments could not be loaded. Please try again.", "Comments will open when this article is published.",
] as const;
export type CommentCopy = Record<(typeof COMMENT_COPY_KEYS)[number], string>;

export type CommentInput = { postId: string; parentId: string | null; authorName: string; authorEmail: string; body: string; requestKey: string; locale: "de" | "en" | "tr" };

/** The same limits are enforced on the server, including replies and retries. */
export function parseCommentInput(value: unknown): CommentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.parentId !== undefined && input.parentId !== null && typeof input.parentId !== "string") return null;
  const text = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const authorName = text("name").replace(/\s+/g, " ");
  const authorEmail = text("email").toLowerCase();
  const body = text("body");
  const postId = text("postId");
  const parentId = text("parentId") || null;
  const requestKey = text("requestKey");
  const locale = text("locale");
  if (text("website") || !/^[a-z0-9]{1,64}$/i.test(postId) || (parentId && !/^[a-z0-9]{1,64}$/i.test(parentId))) return null;
  if (authorName.length < COMMENT_LIMITS.nameMin || authorName.length > COMMENT_LIMITS.nameMax || /[\u0000-\u001f\u007f]/.test(authorName)) return null;
  if (authorEmail.length > COMMENT_LIMITS.emailMax || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) return null;
  if (body.length < COMMENT_LIMITS.bodyMin || body.length > COMMENT_LIMITS.bodyMax || /\u0000/.test(body)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return null;
  return { postId, parentId, authorName, authorEmail, body, requestKey, locale: locale === "de" || locale === "tr" ? locale : "en" };
}
