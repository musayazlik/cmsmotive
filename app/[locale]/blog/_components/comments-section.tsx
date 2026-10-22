import { getPublicComments } from "@/lib/blog-comments";
import { COMMENT_COPY_KEYS, type CommentCopy } from "@/lib/blog-comments-shared";
import { getTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import BlogComments from "./comments";

export default async function CommentsSection({ postId, locale, preview }: { postId: string; locale: Locale; preview: boolean }) {
  const t = getTranslator(locale);
  const copy = Object.fromEntries(COMMENT_COPY_KEYS.map((key) => [key, t(key)])) as CommentCopy;
  const initial = preview ? { comments: [], count: 0, nextCursor: null } : await getPublicComments(postId);
  return <BlogComments postId={postId} locale={locale} initial={initial} copy={copy} preview={preview} />;
}
