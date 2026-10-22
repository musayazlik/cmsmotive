import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, after } from "node:test";
import { prisma } from "../lib/prisma";
import { runCommentAiReview } from "../lib/comment-ai";
import { getPublicComments } from "../lib/blog-comments";
import type { CommentAiResult } from "../lib/comment-ai-result";

test("AI review preserves administrator control, handles failures and serializes retries", async () => {
  const post = await prisma.post.create({ data: { title: "AI moderation verification", slug: `comment-ai-check-${randomUUID()}`, status: "draft" } });
  try {
    const comment = await prisma.postComment.create({ data: { postId: post.id, authorName: "Test reader", authorEmail: "ai-verification@example.test", body: "A useful article, thanks.", requestKey: randomUUID() } });
    const row = () => prisma.postComment.findUniqueOrThrow({ where: { id: comment.id } });
    const verdict = (status: "passed" | "flagged"): CommentAiResult => ({ status, note: status === "passed" ? "Respectful discussion." : "Review advertising links.", model: "test/model" });

    await runCommentAiReview(comment.id, async (body) => { assert.equal(body, comment.body); return verdict("passed"); });
    assert.equal((await row()).aiStatus, "passed");
    assert.equal((await row()).status, "pending");
    assert.equal((await getPublicComments(post.id)).count, 0);
    await runCommentAiReview(comment.id, async () => verdict("flagged"));
    assert.equal((await row()).aiStatus, "flagged");
    assert.equal((await row()).status, "pending");

    await runCommentAiReview(comment.id, async () => { throw new Error("Provider timeout with sensitive detail"); });
    assert.equal((await row()).aiStatus, "error");
    assert.ok(!(await row()).aiNote?.includes("sensitive"));
    await runCommentAiReview(comment.id, async () => ({ status: "unavailable", note: "Configure the provider.", model: null }));
    assert.equal((await row()).aiStatus, "unavailable");

    let release!: (result: CommentAiResult) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const delayed = runCommentAiReview(comment.id, () => { started(); return new Promise<CommentAiResult>((resolve) => { release = resolve; }); });
    await ready;
    assert.equal(await runCommentAiReview(comment.id, async () => { throw new Error("Concurrent review should not run"); }), false);
    // A stalled worker can be reclaimed. Its eventual result cannot overwrite the newer verdict.
    await prisma.postComment.update({ where: { id: comment.id }, data: { aiCheckedAt: new Date(Date.now() - 100_000) } });
    await runCommentAiReview(comment.id, async () => verdict("flagged"));
    release(verdict("passed"));
    await delayed;
    assert.equal((await row()).aiStatus, "flagged");
    assert.equal((await row()).aiReviewToken, null);

    await prisma.postComment.update({ where: { id: comment.id }, data: { status: "approved" } });
    await runCommentAiReview(comment.id, async () => verdict("flagged"));
    assert.equal((await row()).status, "approved");
    const publicData = JSON.stringify(await getPublicComments(post.id));
    assert.ok(!publicData.includes("aiStatus") && !publicData.includes("test/model") && !publicData.includes("authorEmail"));
    await prisma.postComment.delete({ where: { id: comment.id } });
    assert.equal(await runCommentAiReview(comment.id), false);
  } finally { await prisma.post.delete({ where: { id: post.id } }); }
});

after(() => prisma.$disconnect());
