import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { runCommentAiReview } from "@/lib/comment-ai";
import { getPublicComments } from "@/lib/blog-comments";
import { COMMENT_LIMITS, parseCommentInput } from "@/lib/blog-comments-shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (code: string, status: number) => Response.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const postId = params.get("postId") ?? "";
  const cursor = params.get("cursor") ?? undefined;
  if (!/^[a-z0-9]{1,64}$/i.test(postId) || (cursor && !/^[a-z0-9]{1,64}$/i.test(cursor))) return fail("invalid", 400);
  const post = await prisma.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true } });
  if (!post) return fail("unavailable", 404);
  if (cursor && !await prisma.postComment.findFirst({ where: { id: cursor, postId, status: "approved", parentId: null }, select: { id: true } })) return fail("invalid", 400);
  return Response.json(await getPublicComments(post.id, cursor), { headers: { "Cache-Control": "no-store" } });
}

/** Guest submissions are pending until an administrator moderates them. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("invalid", 403);
  if (Number(request.headers.get("content-length")) > 16384) return fail("invalid", 413);
  const input = parseCommentInput(await request.json().catch(() => null));
  if (!input) return fail("invalid", 400);
  try {
    const createdId = await prisma.$transaction(async (tx) => {
      // Serialize per-email submissions and retries so the hourly limit cannot be raced.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`blog-comment:${input.authorEmail}`}))`;
      const existing = await tx.postComment.findUnique({ where: { requestKey: input.requestKey }, select: { postId: true, authorEmail: true } });
      if (existing) {
        if (existing.postId !== input.postId || existing.authorEmail !== input.authorEmail) throw new Error("invalid");
        return;
      }
      const post = await tx.post.findFirst({ where: { id: input.postId, status: "published" }, select: { id: true } });
      if (!post) throw new Error("unavailable");
      if (input.parentId && !await tx.postComment.findFirst({ where: { id: input.parentId, postId: input.postId, parentId: null, status: "approved" }, select: { id: true } })) throw new Error("unavailable");
      const recent = await tx.postComment.count({ where: { authorEmail: input.authorEmail, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
      if (recent >= COMMENT_LIMITS.perHour) throw new Error("rate-limit");
      const created = await tx.postComment.create({ data: input, select: { id: true } });
      return created.id;
    });
    if (createdId) after(async () => {
      try { await runCommentAiReview(createdId); }
      catch { console.error("Comment AI review could not be persisted", createdId); }
    });
    return Response.json({ ok: true, status: "pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "server";
    if (code === "invalid") return fail(code, 400);
    if (code === "unavailable") return fail(code, 404);
    if (code === "rate-limit") return fail(code, 429);
    console.error("blog comment submission failed", error);
    return fail("server", 500);
  }
}
