import { getLegalSettings } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/prices";
import { walkBlocks, type PageBuilderData } from "./data";
import type { ResolvedProduct } from "./blocks/product-grid/schema";
import type { ResolvedReview } from "./blocks/review-list/schema";
import type { ResolvedPost } from "./blocks/latest-posts/schema";

/**
 * Resolves dynamic data for live data blocks at request time (plan 5.2, Faz 2).
 * Guarantees that catalog, price, review and post updates reflect immediately
 * on public builder pages without republishing.
 *
 * Missing or unlisted products/records are gracefully skipped without crashing.
 */
export async function resolveLivePageData(
  document: PageBuilderData,
  storeId: string,
  _locale: string = "en",
): Promise<PageBuilderData> {
  const cloned: PageBuilderData = JSON.parse(JSON.stringify(document));

  // Every block in the document, including blocks nested in Container/Grid/
  // Section/Stack slots — a hero inside a section must resolve too (plan 5.2).
  const allItems: any[] = [];
  walkBlocks(cloned, (block) => allItems.push(block));
  if (cloned.zones) {
    for (const zoneItems of Object.values(cloned.zones)) {
      if (Array.isArray(zoneItems)) allItems.push(...zoneItems.filter((item) => item && typeof item === "object"));
    }
  }

  // The newsletter consent version follows the store's current legal settings
  // at request time, like the legacy home page's data-consent-version (plan 5.9).
  const newsletterBlocks = allItems.filter((item) => item?.type === "NewsletterBlock");
  if (newsletterBlocks.length > 0) {
    try {
      const { privacyVersion } = await getLegalSettings(storeId);
      // Same character filter as the legacy route's consent-version injection.
      const version = privacyVersion.replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 50);
      for (const item of newsletterBlocks) item.props.privacyVersion = version;
    } catch (err) {
      console.error("Error resolving the legal privacy version:", err);
    }
  }

  const liveBlocks = allItems.filter((item) =>
    ["ProductGridBlock", "ProductSpotlightBlock", "PricingTableBlock", "ReviewListBlock", "LatestPostsBlock"].includes(
      item?.type,
    ),
  );

  if (liveBlocks.length === 0) {
    return cloned;
  }

  await Promise.all(
    liveBlocks.map(async (item) => {
      try {
        switch (item.type) {
          case "ProductGridBlock": {
            const limit = Math.min(24, Math.max(1, Number(item.props?.limit) || 6));
            const category = item.props?.category ? String(item.props.category).trim() : "";

            const products = await prisma.product.findMany({
              where: {
                storeId,
                status: { in: ["preview", "published"] },
                ...(category ? { category } : {}),
              },
              include: {
                cover: true,
                prices: {
                  take: 1,
                  orderBy: { amountCents: "asc" },
                },
              },
              orderBy: { position: "asc" },
              take: limit,
            });

            const resolved: ResolvedProduct[] = products.map((p) => {
              const lowestPrice = p.prices[0];
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                summary: p.summary,
                category: p.category,
                badge: p.badge,
                priceFormatted: lowestPrice ? formatAmount(lowestPrice.amountCents, lowestPrice.currency) : null,
                coverUrl: p.cover?.url || null,
              };
            });

            item.props._resolvedProducts = resolved;
            break;
          }

          case "ProductSpotlightBlock": {
            const slug = item.props?.productSlug ? String(item.props.productSlug).trim() : "";
            if (!slug) {
              item.props._resolvedProduct = null;
              break;
            }

            const p = await prisma.product.findFirst({
              where: {
                storeId,
                slug,
                status: { in: ["preview", "published"] },
              },
              include: {
                cover: true,
                prices: {
                  take: 1,
                  orderBy: { amountCents: "asc" },
                },
              },
            });

            if (!p) {
              item.props._resolvedProduct = null;
              break;
            }

            const lowestPrice = p.prices[0];
            item.props._resolvedProduct = {
              id: p.id,
              slug: p.slug,
              name: p.name,
              summary: p.summary,
              category: p.category,
              badge: p.badge,
              priceFormatted: lowestPrice ? formatAmount(lowestPrice.amountCents, lowestPrice.currency) : null,
              coverUrl: p.cover?.url || null,
            };
            break;
          }

          case "PricingTableBlock": {
            const plans = Array.isArray(item.props?.plans) ? item.props.plans : [];
            const slugs = Array.from(
              new Set(plans.map((plan: any) => plan?.productSlug).filter(Boolean)),
            ) as string[];

            if (slugs.length === 0) break;

            const products = await prisma.product.findMany({
              where: {
                storeId,
                slug: { in: slugs },
                status: { in: ["preview", "published"] },
              },
              include: {
                prices: {
                  take: 1,
                  orderBy: { amountCents: "asc" },
                },
              },
            });

            const priceMap: Record<string, string> = {};
            for (const prod of products) {
              const lowest = prod.prices[0];
              if (lowest) {
                priceMap[prod.slug] = formatAmount(lowest.amountCents, lowest.currency);
              }
            }

            item.props._resolvedPrices = priceMap;
            break;
          }

          case "ReviewListBlock": {
            const limit = Math.min(12, Math.max(1, Number(item.props?.limit) || 3));
            const productSlug = item.props?.productSlug ? String(item.props.productSlug).trim() : "";

            const reviews = await prisma.productReview.findMany({
              where: {
                storeId,
                status: "approved",
                ...(productSlug ? { product: { slug: productSlug } } : {}),
              },
              include: {
                product: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: limit,
            });

            const resolved: ResolvedReview[] = reviews.map((r) => ({
              id: r.id,
              authorName: r.authorName,
              rating: r.rating,
              body: r.body,
              dateFormatted: r.createdAt.toLocaleDateString(),
              productName: r.product?.name,
            }));

            item.props._resolvedReviews = resolved;
            break;
          }

          case "LatestPostsBlock": {
            const limit = Math.min(12, Math.max(1, Number(item.props?.limit) || 3));

            const posts = await prisma.post.findMany({
              where: {
                storeId,
                status: "published",
              },
              include: {
                category: { select: { name: true } },
                cover: { select: { url: true } },
              },
              orderBy: { publishedAt: "desc" },
              take: limit,
            });

            const resolved: ResolvedPost[] = posts.map((post) => ({
              id: post.id,
              slug: post.slug,
              title: post.title,
              excerpt: post.excerpt,
              readingTime: post.readingTime,
              publishedDate: post.publishedAt?.toLocaleDateString(),
              category: post.category?.name || null,
              coverUrl: post.cover?.url || null,
            }));

            item.props._resolvedPosts = resolved;
            break;
          }
        }
      } catch (err) {
        // Individual block failure never breaks page render
        console.error(`Error resolving live block ${item.type}:`, err);
      }
    }),
  );

  return cloned;
}
