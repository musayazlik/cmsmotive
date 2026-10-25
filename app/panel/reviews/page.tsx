import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import { isReviewStatus, productPath } from "@/lib/reviews";
import ReviewList from "./_components/review-list";
import type { ReviewRow } from "./_lib";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

/** Safety ceiling so an unexpected backlog cannot stall the panel. */
const REVIEW_LIMIT = 500;

const productSelect = { select: { id: true, name: true, slug: true } } as const;

/** `?product=<id>` (linked from a product's edit page) opens the list filtered to that product. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const { product } = await searchParams;
  const [reviews, products] = await Promise.all([
    prisma.productReview.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: REVIEW_LIMIT,
      include: { product: productSelect },
    }),
    prisma.product.findMany({
      where: { OR: [{ storeId }, { listings: { some: { storeId } } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: ReviewRow[] = reviews.map(({ product, ...review }) => ({
    id: review.id,
    /** Falls back to the recorded slug when the reviewed product was deleted. */
    productKey: product?.id ?? `slug:${review.productSlug}`,
    productSlug: product?.slug ?? review.productSlug,
    productName: product?.name ?? review.productSlug,
    productPath: productPath(product?.slug ?? review.productSlug),
    authorName: review.authorName,
    authorEmail: review.authorEmail,
    rating: review.rating,
    body: review.body,
    status: isReviewStatus(review.status) ? review.status : "pending",
    locale: review.locale,
    moderatedAt: review.moderatedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
  }));

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
            Guest reviews from the product pages wait here until you approve them. Only approved reviews are shown
            publicly and count towards a product&apos;s star rating. Filter by product to moderate one product at a
            time.
          </p>
        </div>
        <span className="workspace-index">REVIEWS</span>
      </div>

      <ReviewList
        rows={rows}
        limit={REVIEW_LIMIT}
        products={products.map((entry) => ({ value: entry.id, label: entry.name }))}
        initialProduct={product ?? ""}
      />
    </>
  );
}
