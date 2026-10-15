/**
 * Products that accept reviews. Keys match the static-site detail pages
 * (static-site/theme-<key>.html, built by build.py) and are stored as
 * ProductReview.productSlug.
 */
export const REVIEW_PRODUCTS = {
  nordform: { name: "Nordform", path: "/theme-nordform" },
  foundation: { name: "Foundation", path: "/theme-foundation" },
  campus: { name: "Campus", path: "/theme-campus" },
} as const;

export type ReviewProductSlug = keyof typeof REVIEW_PRODUCTS;

export function isReviewProduct(value: unknown): value is ReviewProductSlug {
  return typeof value === "string" && Object.hasOwn(REVIEW_PRODUCTS, value);
}

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** reCAPTCHA v3 action name shared by the page script and the API. */
export const REVIEW_CAPTCHA_ACTION = "product_review";

export const REVIEW_LIMITS = { nameMin: 2, nameMax: 80, emailMax: 254, bodyMin: 10, bodyMax: 2000 } as const;

/** Reviews one e-mail address may send per hour, across all products. */
export const REVIEWS_PER_HOUR = 3;

/** "Musa Yazlık" -> "Musa Y.": public pages never show a full surname. */
export function publicAuthorName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
