"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { isCommentStatus } from "@/lib/blog-comments-shared";
import { runCommentAiReview } from "@/lib/comment-ai";
import { panelStore } from "@/lib/panel-store";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/panel", "layout");
  revalidatePath("/[locale]/blog/[slug]", "page");
}

export async function recheckComment(id: string): Promise<Result> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to review comments." };
  if (typeof id !== "string" || !/^[a-z0-9]{1,64}$/i.test(id)) return { ok: false, error: "Invalid comment." };
  try {
    if (!(await prisma.postComment.findFirst({ where: { id, post: { storeId: (await panelStore()).id } }, select: { id: true } }))) {
      return { ok: false, error: "This comment no longer exists." };
    }
    const checked = await runCommentAiReview(id);
    refresh();
    return checked ? { ok: true } : { ok: false, error: "This comment is already being checked or no longer exists." };
  } catch {
    return { ok: false, error: "AI review could not be saved. Please try again." };
  }
}

export async function moderateComment(id: string, status: string): Promise<Result> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to moderate comments." };
  if (!isCommentStatus(status) || typeof id !== "string" || !id) return { ok: false, error: "Invalid comment or status." };
  try {
    await prisma.postComment.update({ where: { id, post: { storeId: (await panelStore()).id } }, data: { status, moderatedAt: status === "pending" ? null : new Date() } });
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("comment moderation failed", error);
    return { ok: false, error: "The comment could not be updated. Please try again." };
  }
}

export async function deleteComment(id: string): Promise<Result> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to delete comments." };
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid comment." };
  try {
    await prisma.postComment.delete({ where: { id, post: { storeId: (await panelStore()).id } } });
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("comment deletion failed", error);
    return { ok: false, error: "The comment could not be deleted. Please try again." };
  }
}
