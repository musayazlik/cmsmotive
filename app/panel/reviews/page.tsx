import { requirePanelUser } from "@/lib/panel-auth";
import { prisma } from "@/lib/prisma";
import { isReviewStatus, productPath } from "@/lib/reviews";
import ReviewList from "./_components/review-list";
import type { ReviewRow } from "./_lib";

export const dynamic = "force-dynamic";

/** Safety ceiling so an unexpected backlog cannot stall the panel. */
const REVIEW_LIMIT = 500;

const productSelect = { select: { id: true, name: true, slug: true } } as const;

/** `?product=theme:<id>` (linked from a theme's edit page) opens the list filtered to that product. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  await requirePanelUser();
  const { product } = await searchParams;
  const [reviews, themes, extensions] = await Promise.all([
    prisma.productReview.findMany({
      orderBy: { createdAt: "desc" },
      take: REVIEW_LIMIT,
      include: { theme: productSelect, extension: productSelect },
    }),
    prisma.theme.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.extension.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const products = [
    ...themes.map((theme) => ({ value: `theme:${theme.id}`, label: `Theme · ${theme.name}` })),
    ...extensions.map((extension) => ({ value: `extension:${extension.id}`, label: `Extension · ${extension.name}` })),
  ];

  const rows: ReviewRow[] = reviews.map(({ theme, extension, ...review }) => {
    const type = theme ? "theme" : extension ? "extension" : null;
    const target = theme ?? extension;
    return {
      id: review.id,
      productType: type,
      productKey: type && target ? `${type}:${target.id}` : `slug:${review.productSlug}`,
      productSlug: target?.slug ?? review.productSlug,
      productName: target?.name ?? review.productSlug,
      productPath: type && target ? productPath(type, target.slug) : "/themes",
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
            Guest reviews from the theme and extension pages wait here until you approve them. Only approved reviews
            are shown publicly and count towards a product&apos;s star rating. Filter by product to moderate one
            theme or extension at a time.
          </p>
        </div>
        <span className="workspace-index">REVIEWS</span>
      </div>

      <ReviewList rows={rows} limit={REVIEW_LIMIT} products={products} initialProduct={product ?? ""} />
    </>
  );
}
