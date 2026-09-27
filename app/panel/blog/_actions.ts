"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { slugify } from "@/lib/slug";
import {
  estimateReadingTime,
  isPostStatus,
  isValidSlug,
  resolveSlug,
  TITLE_MAX,
  EXCERPT_MAX,
  type ActionResult,
  type CategoryInput,
  type PostInput,
  type PostStatus,
  type QuickCreateResult,
  type TagInput,
} from "./_lib";

/**
 * Blog mutations for the panel. Every action re-checks the admin role because
 * server actions are reachable endpoints, unlike the page layout guard.
 */

function revalidateBlog() {
  revalidatePath("/panel/blog");
  revalidatePath("/panel/blog/categories");
  revalidatePath("/panel/blog/tags");
}

/** Appends -2, -3, … until the slug is free (excluding the edited record). */
async function uniqueSlug(
  model: "post" | "category" | "tag",
  slug: string,
  excludeId?: string,
): Promise<string> {
  const base = slug || model;
  let candidate = base;
  let counter = 2;
  for (;;) {
    let existing: { id: string } | null = null;
    if (model === "post") {
      existing = await prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } });
    } else if (model === "category") {
      existing = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    } else {
      existing = await prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } });
    }
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function savePost(input: PostInput): Promise<ActionResult> {
  const { session, failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Title must be at most ${TITLE_MAX} characters.` };
  }

  const excerpt = input.excerpt.trim();
  if (excerpt.length > EXCERPT_MAX) {
    return { ok: false, error: `Description must be at most ${EXCERPT_MAX} characters.` };
  }

  if (!isPostStatus(input.status)) {
    return { ok: false, error: "Status must be one of: draft, scheduled, published." };
  }

  const slug = resolveSlug(input.slug, title);
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug may only contain lowercase letters, numbers and hyphens." };
  }

  const scheduledAt =
    input.status === "scheduled" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.status === "scheduled" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
    return { ok: false, error: "Pick a date and time to schedule this post." };
  }

  const coverId = input.coverId;
  if (coverId) {
    const cover = await prisma.mediaAsset.findUnique({ where: { id: coverId }, select: { id: true } });
    if (!cover) return { ok: false, error: "Cover image could not be found." };
  }

  const categoryId = input.categoryId;
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return { ok: false, error: "Category could not be found." };
  }

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length > 0) {
    const found = await prisma.tag.count({ where: { id: { in: tagIds } } });
    if (found !== tagIds.length) {
      return { ok: false, error: "One or more tags could not be found." };
    }
  }

  try {
    const finalSlug = await uniqueSlug("post", slug, input.id);
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
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
    };

    if (input.id) {
      const existing = await prisma.post.findUnique({
        where: { id: input.id },
        select: { publishedAt: true },
      });
      if (!existing) return { ok: false, error: "Post could not be found." };

      await prisma.post.update({
        where: { id: input.id },
        data: {
          ...data,
          // Keep the original first-publish date; a draft reset clears it.
          publishedAt:
            input.status === "published" ? (existing.publishedAt ?? new Date()) : null,
        },
      });
    } else {
      await prisma.post.create({
        data: {
          ...data,
          authorId: session?.user.id ?? null,
          publishedAt: input.status === "published" ? new Date() : null,
        },
      });
    }

    revalidateBlog();
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A post with this slug already exists." };
    }
    console.error("savePost failed", error);
    return { ok: false, error: "The post could not be saved." };
  }
}

/** Publishes or unpublishes a post from the list view. */
export async function setPostStatus(id: string, status: PostStatus): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };
  if (status !== "draft" && status !== "published") {
    return { ok: false, error: "Status must be either draft or published." };
  }

  try {
    const existing = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { ok: false, error: "Post could not be found." };

    await prisma.post.update({
      where: { id },
      data: {
        status,
        scheduledAt: null,
        publishedAt: status === "published" ? new Date() : null,
      },
    });
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    console.error("setPostStatus failed", error);
    return { ok: false, error: "The status could not be changed." };
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    await prisma.post.delete({ where: { id } });
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    console.error("deletePost failed", error);
    return { ok: false, error: "The post could not be deleted." };
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Category name is required." };
  if (name.length > 60) return { ok: false, error: "Category name must be at most 60 characters." };

  const description = input.description.trim();
  if (description.length > 200) {
    return { ok: false, error: "Description must be at most 200 characters." };
  }

  // #RRGGBB or #RRGGBBAA (alpha comes from the picker's opacity track).
  const color = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(input.color) ? input.color : "#4353e8";
  const slug = slugify(input.slug.trim() || name);
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug may only contain lowercase letters, numbers and hyphens." };
  }

  try {
    if (input.id) {
      const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
      if (clash && clash.id !== input.id) {
        return { ok: false, error: "A category with this slug already exists." };
      }
      await prisma.category.update({
        where: { id: input.id },
        data: { name, slug, description: description || null, color },
      });
    } else {
      const slug2 = await uniqueSlug("category", slug);
      await prisma.category.create({
        data: { name, slug: slug2, description: description || null, color },
      });
    }
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A category with this slug already exists." };
    }
    console.error("saveCategory failed", error);
    return { ok: false, error: "The category could not be saved." };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    // Posts keep existing via onDelete: SetNull — they just become uncategorized.
    await prisma.category.delete({ where: { id } });
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    console.error("deleteCategory failed", error);
    return { ok: false, error: "The category could not be deleted." };
  }
}

/** Quick-create from the post form; returns the id so the form can select it. */
export async function quickCreateCategory(name: string): Promise<QuickCreateResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Category name is required." };

  const slug = slugify(trimmed);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return { ok: true, id: existing.id, name: existing.name };

  const result = await saveCategory({ name: trimmed, slug, description: "", color: "#4353e8" });
  if (!result.ok) return { ok: false, error: result.error };

  const created = await prisma.category.findUnique({ where: { slug }, select: { id: true, name: true } });
  return created
    ? { ok: true, id: created.id, name: created.name }
    : { ok: false, error: "The category could not be created." };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function saveTag(input: TagInput): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Tag name is required." };
  if (name.length > 40) return { ok: false, error: "Tag name must be at most 40 characters." };

  const slug = slugify(input.slug.trim() || name);
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug may only contain lowercase letters, numbers and hyphens." };
  }

  try {
    if (input.id) {
      const clash = await prisma.tag.findUnique({ where: { slug }, select: { id: true } });
      if (clash && clash.id !== input.id) {
        return { ok: false, error: "A tag with this slug already exists." };
      }
      await prisma.tag.update({ where: { id: input.id }, data: { name, slug } });
    } else {
      const slug2 = await uniqueSlug("tag", slug);
      await prisma.tag.create({ data: { name, slug: slug2 } });
    }
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A tag with this slug already exists." };
    }
    console.error("saveTag failed", error);
    return { ok: false, error: "The tag could not be saved." };
  }
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    await prisma.tag.delete({ where: { id } });
    revalidateBlog();
    return { ok: true };
  } catch (error) {
    console.error("deleteTag failed", error);
    return { ok: false, error: "The tag could not be deleted." };
  }
}

/** Quick-create from the post form; returns the id so the form can select it. */
export async function quickCreateTag(name: string): Promise<QuickCreateResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Tag name is required." };

  const slug = slugify(trimmed);
  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) return { ok: true, id: existing.id, name: existing.name };

  const result = await saveTag({ name: trimmed, slug });
  if (!result.ok) return { ok: false, error: result.error };

  const created = await prisma.tag.findUnique({ where: { slug }, select: { id: true, name: true } });
  return created
    ? { ok: true, id: created.id, name: created.name }
    : { ok: false, error: "The tag could not be created." };
}
