import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePanelUser } from "@/lib/panel-auth";
import { isCommentStatus } from "@/lib/blog-comments-shared";
import CommentList from "./comment-list";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const params = await searchParams;
  const first = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const status = first("status") === "all" ? "all" : isCommentStatus(first("status")) ? first("status") : "pending";
  const query = first("q").trim().slice(0, 200);
  const postId = first("post").slice(0, 64);
  const base: Prisma.PostCommentWhereInput = {
    post: { storeId },
    ...(postId ? { postId } : {}),
    ...(query ? { OR: [
      { authorName: { contains: query, mode: "insensitive" } },
      { authorEmail: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
      { post: { storeId, title: { contains: query, mode: "insensitive" } } },
    ] } : {}),
  };
  const [groups, posts] = await Promise.all([
    prisma.postComment.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.post.findMany({ where: { storeId, comments: { some: {} } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const group of groups) {
    counts.all += group._count._all;
    if (isCommentStatus(group.status)) counts[group.status] = group._count._all;
  }
  const total = counts[status as keyof typeof counts];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number.parseInt(first("page"), 10);
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requested) ? requested : 1));
  const rows = await prisma.postComment.findMany({
    where: { ...base, ...(status === "all" ? {} : { status }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    include: { post: { select: { id: true, title: true, slug: true } }, parent: { select: { authorName: true } }, _count: { select: { replies: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow"><span className="workspace-dot" /> BLOG / COMMENTS</div>
      <div className="workspace-intro">
        <div><h1>Blog comments</h1><p>Read the AI review, then decide what to publish. Every comment needs administrator approval.</p></div>
      </div>
      <CommentList
        key={`${status}:${query}:${postId}:${page}`}
        rows={rows.map((row) => ({ id: row.id, authorName: row.authorName, authorEmail: row.authorEmail, body: row.body, status: row.status, locale: row.locale, createdAt: row.createdAt.toISOString(), post: row.post, replyTo: row.parent?.authorName ?? null, replies: row._count.replies, aiStatus: row.aiStatus, aiNote: row.aiNote, aiModel: row.aiModel, aiCheckedAt: row.aiCheckedAt?.toISOString() ?? null }))}
        counts={counts} status={status} query={query} postId={postId} posts={posts} page={page} pageCount={pageCount} total={total}
      />
    </>
  );
}
