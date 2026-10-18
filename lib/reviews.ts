/**
 * Every theme and extension accepts reviews on its detail page
 * (/theme/<slug>, /extension/<slug>). product.js sends the product type and
 * slug; the API resolves them to ProductReview.themeId / extensionId.
 */
export const REVIEW_PRODUCT_TYPES = ["theme", "extension"] as const;
export type ReviewProductType = (typeof REVIEW_PRODUCT_TYPES)[number];

export function isReviewProductType(value: unknown): value is ReviewProductType {
  return typeof value === "string" && (REVIEW_PRODUCT_TYPES as readonly string[]).includes(value);
}

/** Public detail page of a reviewed product. */
export function productPath(type: ReviewProductType, slug: string) {
  return `/${type}/${slug}`;
}

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** reCAPTCHA v3 action name shared by the page script and the API. */
export const REVIEW_CAPTCHA_ACTION = "product_review";

export const REVIEW_LIMITS = { nameMin: 2, nameMax: 80, emailMax: 254, bodyMin: 10, bodyMax: 2000 } as const;

/** "Musa Yazlık" -> "Musa Y.": public pages never show a full surname. */
export function publicAuthorName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
