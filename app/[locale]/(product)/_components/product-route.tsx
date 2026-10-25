import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { localizePath, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translate";
import { loadProductPage, type ProductKind, type ProductPageData } from "@/lib/product-page";
import { absoluteUrl, breadcrumbSchema, pageMetadata, siteOrigin } from "@/lib/seo";
import { JsonLd } from "../../_components/json-ld";
import ProductDetail from "./product-detail";
import { getLegalSettings } from "@/lib/legal";
import { legalReadiness } from "@/lib/legal-settings-shared";
import { creemConfigured } from "@/lib/creem";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{plan?:string}> };

const KIND_LABEL: Record<ProductKind, string> = { theme: "TYPO3 theme", extension: "TYPO3 extension" };

/**
 * Product and breadcrumb structured data. Offers are only listed once a
 * product is published (concepts cannot be bought yet); the rating comes
 * from approved reviews.
 */
async function productJsonLd(product: ProductPageData, locale: Locale) {
  const t = getTranslator(locale, { quiet: true });
  const origin = await siteOrigin();
  const url = absoluteUrl(origin, localizePath(`/${product.kind}/${product.slug}`, locale));
  const images = [product.cover, ...product.gallery].flatMap((image) => (image ? [absoluteUrl(origin, image.url)] : []));

  const rating = await prisma.productReview.aggregate({
    where: { status: "approved", ...(product.kind === "theme" ? { theme: { slug: product.slug } } : { extension: { slug: product.slug } }) },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const legal = await getLegalSettings();
  const prices = product.plans.map(plan => plan.priceCents / 100);
  const offerBase = { priceCurrency: "EUR", availability: "https://schema.org/InStock", url };
  const offers =
    product.status !== "published" || prices.length === 0 || !creemConfigured() || legalReadiness(legal).length > 0 || !legal.salesTermsReviewed
      ? null
      : prices.length === 1
        ? { "@type": "Offer", price: prices[0], ...offerBase }
        : { "@type": "AggregateOffer", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length, ...offerBase };

  const listPath = product.kind === "theme" ? "/themes" : "/extensions";
  return [
    {
      "@type": "Product",
      name: product.name,
      description: t(product.summary),
      url,
      category: t(KIND_LABEL[product.kind]),
      brand: { "@type": "Brand", name: "CMSMotive" },
      ...(images.length ? { image: images } : {}),
      ...(offers ? { offers } : {}),
      ...(rating._count._all > 0 && rating._avg.rating !== null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Math.round(rating._avg.rating * 10) / 10,
              reviewCount: rating._count._all,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    },
    breadcrumbSchema(origin, [
      { name: t("Home"), url: localizePath("/", locale) },
      { name: t(product.kind === "theme" ? "Themes" : "Extensions"), url: localizePath(listPath, locale) },
      { name: product.name, url },
    ]),
  ].filter((entry) => entry !== null);
}

/** Metadata and page component for /theme/<slug> and /extension/<slug>. */
export function productRoute(kind: ProductKind) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, slug } = await params;
    const t = getTranslator(locale as Locale, { quiet: true });
    const product = await loadProductPage(kind, slug);
    if (!product) return { title: `${t("Page not found")} — CMSMotive` };
    return pageMetadata({
      locale: locale as Locale,
      path: `/${kind}/${product.slug}`,
      title: `${product.name} ${t(KIND_LABEL[kind])} — CMSMotive`,
      description: t(product.summary),
      image: product.cover ?? product.gallery[0] ?? null,
    });
  }

  async function Page({ params, searchParams }: Props) {
    const { locale, slug } = await params;
    const product = await loadProductPage(kind, slug);
    if (!product) notFound();
    // Same analytics keys as the static theme-<slug> pages these replace.
    trackPageView(`${kind}-${product.slug}`);
    return (
      <>
        <JsonLd data={await productJsonLd(product, locale as Locale)} />
        <ProductDetail product={product} locale={locale as Locale} initialPlanId={(await searchParams).plan} />
      </>
    );
  }

  return { generateMetadata, Page };
}
