import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicComment, PublicComments } from "./blog-comments-shared";

const select = { id: true, authorName: true, body: true, createdAt: true } as const;
const serialize = (row: Omit<PublicComment, "createdAt"> & { createdAt: Date }): PublicComment => ({ id: row.id, authorName: row.authorName, body: row.body, createdAt: row.createdAt.toISOString() });

/** Read only approved root comments and approved replies; never select email addresses. */
export async function getPublicComments(postId: string, cursor?: string, db: Pick<Prisma.TransactionClient, "postComment"> = prisma): Promise<PublicComments> {
  const [roots, count] = await Promise.all([
    db.postComment.findMany({
      where: { postId, status: "approved", parentId: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        ...select,
        replies: { where: { status: "approved" }, orderBy: { createdAt: "asc" }, take: 100, select },
      },
    }),
    db.postComment.count({ where: { postId, status: "approved", OR: [{ parentId: null }, { parent: { status: "approved" } }] } }),
  ]);
  const page = roots.slice(0, 20);
  return {
    comments: page.map(({ replies, ...row }) => ({ ...serialize(row), replies: replies.map(serialize) })),
    count,
    nextCursor: roots.length > 20 ? page.at(-1)?.id ?? null : null,
  };
}
