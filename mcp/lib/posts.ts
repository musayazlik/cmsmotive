import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  estimateReadingTime,
  EXCERPT_MAX,
  isPostStatus,
  isValidSlug,
  resolveSlug,
  TITLE_MAX,
  type PostStatus,
} from "@/app/panel/blog/_lib";
import { ToolError } from "./result";
import { mcpStoreId } from "@/mcp/context";

/**
 * Blog post business rules shared by the MCP tools. The panel keeps the same
 * checks in app/panel/blog/_actions.ts; this module mirrors them without the
 * Next.js server-action wrapper so the standalone MCP process can use them.
 */

export type PostWriteInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverId: string | null;
  status: PostStatus;
  /** ISO string, only used when status is "scheduled". */
  scheduledAt: string | null;
  featured: boolean;
  categoryId: string | null;
  tagIds: string[];
};

/** Publishes scheduled posts whose time has passed, like the panel list does. */
export async function publishDuePosts(): Promise<number> {
  const result = await prisma.post.updateMany({
    where: { storeId: mcpStoreId(), status: "scheduled", scheduledAt: { lte: new Date() } },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  return result.count;
}

/** Appends -2, -3, … until the slug is free (excluding the edited record). */
async function uniquePostSlug(slug: string, excludeId?: string): Promise<string> {
  const base = slug || "post";
  let candidate = base;
  let counter = 2;
  for (;;) {
    const existing = await prisma.post.findUnique({
      where: { storeId_slug: { storeId: mcpStoreId(), slug: candidate } },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function savePostRecord(
  input: PostWriteInput,
  authorId: string | null,
): Promise<{ id: string; slug: string }> {
  const title = input.title.trim();
  if (!title) throw new ToolError("Title is required.");
  if (title.length > TITLE_MAX) {
    throw new ToolError(`Title must be at most ${TITLE_MAX} characters.`);
  }

  const excerpt = input.excerpt.trim();
  if (excerpt.length > EXCERPT_MAX) {
    throw new ToolError(`Description must be at most ${EXCERPT_MAX} characters.`);
  }

  if (!isPostStatus(input.status)) {
    throw new ToolError("Status must be one of: draft, scheduled, published.");
  }

  const slug = resolveSlug(input.slug, title);
  if (!isValidSlug(slug)) {
    throw new ToolError("Slug may only contain lowercase letters, numbers and hyphens.");
  }

  const scheduledAt =
    input.status === "scheduled" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.status === "scheduled" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
    throw new ToolError("Pick a date and time to schedule this post.");
  }
  if (scheduledAt && scheduledAt <= new Date()) {
    throw new ToolError("Choose a future date and time to schedule this post.");
  }

  const coverId = input.coverId;
  if (coverId) {
    const cover = await prisma.mediaAsset.findFirst({
      where: { id: coverId, storeId: mcpStoreId() },
      select: { id: true },
    });
    if (!cover) throw new ToolError("Cover image could not be found.");
  }

  const categoryId = input.categoryId;
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, storeId: mcpStoreId() },
      select: { id: true },
    });
    if (!category) throw new ToolError("Category could not be found.");
  }

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length > 0) {
    const found = await prisma.tag.count({ where: { id: { in: tagIds }, storeId: mcpStoreId() } });
    if (found !== tagIds.length) throw new ToolError("One or more tags could not be found.");
  }

  // A post that goes live — now or on schedule — needs a category and at
  // least one tag; drafts stay unrestricted.
  if (input.status !== "draft" && (!categoryId || tagIds.length === 0)) {
    throw new ToolError("Add a category and at least one tag before publishing this post.");
  }

  try {
    const finalSlug = await uniquePostSlug(slug, input.id);
    const data = {
      title,
      slug: finalSlug,
      excerpt,
      content: input.content,
      coverId: coverId ?? null,
      status: input.status,
      scheduledAt,
      featured: input.featured,
      readingTime: estimateReadingTime(input.content),
      categoryId: categoryId ?? null,
    };
    const tagLinks = tagIds.map((tagId) => ({ tagId }));

    if (input.id) {
      const existing = await prisma.post.findFirst({
        where: { id: input.id, storeId: mcpStoreId() },
        select: { publishedAt: true },
      });
      if (!existing) throw new ToolError("Post could not be found.");

      await prisma.post.update({
        where: { id: input.id, storeId: mcpStoreId() },
        data: {
          ...data,
          tags: { deleteMany: {}, create: tagLinks },
          // Keep the original first-publish date; a draft reset clears it.
          publishedAt:
            input.status === "published" ? (existing.publishedAt ?? new Date()) : null,
        },
      });
      return { id: input.id, slug: finalSlug };
    }

    const created = await prisma.post.create({
      data: {
        ...data,
        storeId: mcpStoreId(),
        tags: { create: tagLinks },
        authorId,
        publishedAt: input.status === "published" ? new Date() : null,
      },
      select: { id: true, slug: true },
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ToolError("A post with this slug already exists.");
    }
    throw error;
  }
}

export async function setPostStatusRecord(
  id: string,
  status: "draft" | "published",
): Promise<{ id: string; status: string }> {
  if (status !== "draft" && status !== "published") {
    throw new ToolError("Status must be either draft or published.");
  }

  const existing = await prisma.post.findFirst({
    where: { id, storeId: mcpStoreId() },
    select: { id: true, categoryId: true, _count: { select: { tags: true } } },
  });
  if (!existing) throw new ToolError("Post could not be found.");
  if (status === "published" && (!existing.categoryId || existing._count.tags === 0)) {
    throw new ToolError("Add a category and at least one tag before publishing this post.");
  }

  await prisma.post.update({
    where: { id, storeId: mcpStoreId() },
    data: {
      status,
      scheduledAt: null,
      publishedAt: status === "published" ? new Date() : null,
    },
  });
  return { id, status };
}

export async function deletePostRecord(id: string): Promise<{ id: string; deleted: true }> {
  const existing = await prisma.post.findFirst({ where: { id, storeId: mcpStoreId() }, select: { id: true } });
  if (!existing) throw new ToolError("Post could not be found.");
  await prisma.post.delete({ where: { id: existing.id } });
  return { id, deleted: true };
}
