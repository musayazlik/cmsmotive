import type { ReviewStatus } from "@/lib/reviews";

/**
 * Shared types and formatters for review moderation. The page hands the
 * client every row (newest first) so the status tabs and search filter
 * without further server round trips, like the contact inbox.
 */

export type ReviewRow = {
  id: string;
  productSlug: string;
  productName: string;
  productPath: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  locale: string;
  moderatedAt: string | null;
  createdAt: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}
