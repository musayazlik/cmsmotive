import { SLUG_PATTERN } from "@/lib/catalog-guard";
import { slugify } from "@/lib/slug";

/** SEO title stays inside Google's ~60 character display limit. */
export const TITLE_MAX = 60;
/** Meta description / excerpt stays inside the ~160 character display limit. */
export const EXCERPT_MAX = 160;

export const POST_STATUSES = ["draft", "scheduled", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export function isPostStatus(value: unknown): value is PostStatus {
  return typeof value === "string" && (POST_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Result of the quick-create helpers used inside the post form. */
export type QuickCreateResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

export type CoverRef = { assetId: string; url: string; name: string };

export type PostInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverId: string | null;
  status: PostStatus;
  /** ISO string of the scheduled publish target; required when status is scheduled. */
  scheduledAt: string | null;
  featured: boolean;
  categoryId: string | null;
  tagIds: string[];
};

export type PostFormInitial = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover: CoverRef | null;
  status: PostStatus;
  /** ISO string or null. */
  scheduledAt: string | null;
  featured: boolean;
  categoryId: string | null;
  tagIds: string[];
};

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: PostStatus;
  featured: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  readingTime: number;
  cover: CoverRef | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  tags: { id: string; name: string }[];
  updatedAt: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  postCount: number;
  createdAt: string;
};

export type TagRow = {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
};

export type CategoryInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  color: string;
};

export type TagInput = {
  id?: string;
  name: string;
  slug: string;
};

/** Resolves the stored slug: normalizes edits and falls back to the title. */
export function resolveSlug(slug: string, title: string): string {
  return slugify(slug.trim() || title);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Rough reading time in minutes, rounded up, at 200 words per minute. */
export function estimateReadingTime(html: string): number {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
