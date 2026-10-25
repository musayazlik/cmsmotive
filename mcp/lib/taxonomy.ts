import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isValidSlug } from "@/app/panel/blog/_lib";
import { ToolError } from "./result";
import { mcpStoreId } from "@/mcp/context";

/**
 * Category and tag rules mirrored from app/panel/blog/_actions.ts. Slugs are
 * generated from the name when omitted and de-duplicated with -2, -3, ….
 */

type TaxonomyModel = "category" | "tag";

async function uniqueSlug(
  model: TaxonomyModel,
  slug: string,
  excludeId?: string,
): Promise<string> {
  const base = slug || model;
  let candidate = base;
  let counter = 2;
  for (;;) {
    const existing =
      model === "category"
        ? await prisma.category.findUnique({ where: { storeId_slug: { storeId: mcpStoreId(), slug: candidate } }, select: { id: true } })
        : await prisma.tag.findUnique({ where: { storeId_slug: { storeId: mcpStoreId(), slug: candidate } }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type CategoryInput = {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
};

export async function saveCategoryRecord(
  input: CategoryInput,
): Promise<{ id: string; name: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new ToolError("Category name is required.");
  if (name.length > 60) throw new ToolError("Category name must be at most 60 characters.");

  const description = (input.description ?? "").trim();
  if (description.length > 200) {
    throw new ToolError("Description must be at most 200 characters.");
  }

  const rawColor = (input.color ?? "").trim();
  const color = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(rawColor) ? rawColor : "#4353e8";
  const slug = slugify((input.slug ?? "").trim() || name);
  if (!isValidSlug(slug)) {
    throw new ToolError("Slug may only contain lowercase letters, numbers and hyphens.");
  }

  try {
    if (input.id) {
      const clash = await prisma.category.findUnique({ where: { storeId_slug: { storeId: mcpStoreId(), slug } }, select: { id: true } });
      if (clash && clash.id !== input.id) {
        throw new ToolError("A category with this slug already exists.");
      }
      const updated = await prisma.category.update({
        where: { id: input.id, storeId: mcpStoreId() },
        data: { name, slug, description: description || null, color },
        select: { id: true, name: true, slug: true },
      });
      return updated;
    }

    const finalSlug = await uniqueSlug("category", slug);
    const created = await prisma.category.create({
      data: { storeId: mcpStoreId(), name, slug: finalSlug, description: description || null, color },
      select: { id: true, name: true, slug: true },
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ToolError("A category with this slug already exists.");
    }
    throw error;
  }
}

export async function deleteCategoryRecord(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const existing = await prisma.category.findFirst({ where: { id, storeId: mcpStoreId() }, select: { id: true } });
  if (!existing) throw new ToolError("Category could not be found.");
  // Posts keep existing via onDelete: SetNull — they just become uncategorized.
  await prisma.category.delete({ where: { id: existing.id } });
  return { id, deleted: true };
}

export type TagInput = {
  id?: string;
  name: string;
  slug?: string;
};

export async function saveTagRecord(
  input: TagInput,
): Promise<{ id: string; name: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new ToolError("Tag name is required.");
  if (name.length > 40) throw new ToolError("Tag name must be at most 40 characters.");

  const slug = slugify((input.slug ?? "").trim() || name);
  if (!isValidSlug(slug)) {
    throw new ToolError("Slug may only contain lowercase letters, numbers and hyphens.");
  }

  try {
    if (input.id) {
      const clash = await prisma.tag.findUnique({ where: { storeId_slug: { storeId: mcpStoreId(), slug } }, select: { id: true } });
      if (clash && clash.id !== input.id) {
        throw new ToolError("A tag with this slug already exists.");
      }
      const updated = await prisma.tag.update({
        where: { id: input.id, storeId: mcpStoreId() },
        data: { name, slug },
        select: { id: true, name: true, slug: true },
      });
      return updated;
    }

    const finalSlug = await uniqueSlug("tag", slug);
    const created = await prisma.tag.create({
      data: { storeId: mcpStoreId(), name, slug: finalSlug },
      select: { id: true, name: true, slug: true },
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ToolError("A tag with this slug already exists.");
    }
    throw error;
  }
}

export async function deleteTagRecord(id: string): Promise<{ id: string; deleted: true }> {
  const existing = await prisma.tag.findFirst({ where: { id, storeId: mcpStoreId() }, select: { id: true } });
  if (!existing) throw new ToolError("Tag could not be found.");
  await prisma.tag.delete({ where: { id: existing.id } });
  return { id, deleted: true };
}
