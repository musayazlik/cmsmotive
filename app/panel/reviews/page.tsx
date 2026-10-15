import { prisma } from "@/lib/prisma";
import { REVIEW_PRODUCTS, isReviewProduct, isReviewStatus } from "@/lib/reviews";
import ReviewList from "./_components/review-list";
import type { ReviewRow } from "./_lib";

export const dynamic = "force-dynamic";

/** Safety ceiling so an unexpected backlog cannot stall the panel. */
const REVIEW_LIMIT = 500;

export default async function ReviewsPage() {
  const reviews = await prisma.productReview.findMany({
    orderBy: { createdAt: "desc" },
    take: REVIEW_LIMIT,
  });

  const rows: ReviewRow[] = reviews.map((review) => {
    const product = isReviewProduct(review.productSlug) ? REVIEW_PRODUCTS[review.productSlug] : null;
    return {
      id: review.id,
      productSlug: review.productSlug,
      productName: product?.name ?? review.productSlug,
      productPath: product?.path ?? "/themes",
      authorName: review.authorName,
      authorEmail: review.authorEmail,
      rating: review.rating,
      body: review.body,
      status: isReviewStatus(review.status) ? review.status : "pending",
      locale: review.locale,
      moderatedAt: review.moderatedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
    };
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / PRODUCT REVIEWS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Reviews, <em>checked first.</em>
          </h1>
          <p>
            Guest reviews from the theme pages wait here until you approve them. Only approved reviews are
            shown publicly and count towards a product&apos;s star rating.
          </p>
        </div>
        <span className="workspace-index">REVIEWS</span>
      </div>

      <ReviewList rows={rows} limit={REVIEW_LIMIT} />
    </>
  );
}
