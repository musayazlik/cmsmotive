import { prisma } from "@/lib/prisma";

/**
 * Lightweight page-view tracking for the public site. Each legacy page
 * serve bumps a per-slug daily counter; the panel overview summarizes it.
 */

/** UTC midnight of the given day — the bucket all counters key on. */
export function dayBucket(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Counts a view of `slug` on the given store. Never lets analytics delay or fail a page render. */
export function trackPageView(storeId: string, slug: string): void {
  void prisma.pageViewDaily
    .upsert({
      where: { storeId_date_slug: { storeId, date: dayBucket(), slug } },
      update: { views: { increment: 1 } },
      create: { storeId, date: dayBucket(), slug, views: 1 },
    })
    .catch((error) => console.error("trackPageView failed", error));
}
