import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { localizePath, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translate";
import { loadProductPage, type ProductPageData } from "@/lib/product-page";
import { absoluteUrl, breadcrumbSchema, pageMetadata, siteOrigin } from "@/lib/seo";
import { JsonLd } from "../../_components/json-ld";
import ProductDetail from "./product-detail";
import { getLegalSettings } from "@/lib/legal";
import { legalReadiness } from "@/lib/legal-settings-shared";
import { creemConfigured } from "@/lib/creem";
import { currentStoreId } from "@/lib/current-store";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ price?: string }> };

/**
 * Product and breadcrumb structured data. Offers are only listed once a
 * product is published (concepts cannot be bought yet); the rating comes
 * from approved reviews.
 */
async function productJsonLd(storeId: string, product: ProductPageData, locale: Locale) {
  const t = getTranslator(locale, { quiet: true });
  const origin = await siteOrigin();
  const url = absoluteUrl(origin, localizePath(`/products/${product.slug}`, locale));
  const images = [product.cover, ...product.gallery].flatMap((image) => (image ? [absoluteUrl(origin, image.url)] : []));

  const rating = await prisma.productReview.aggregate({
    where: { storeId, status: "approved", productId: product.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const legal = await getLegalSettings(storeId);
  const prices = product.prices.map((price) => price.amountCents / 100);
  const offerBase = { priceCurrency: product.prices[0]?.currency ?? "EUR", availability: "https://schema.org/InStock", url };
  const offers =
    product.status !== "published" || prices.length === 0 || !creemConfigured() || legalReadiness(legal).length > 0 || !legal.salesTermsReviewed
      ? null
      : prices.length === 1
        ? { "@type": "Offer", price: prices[0], ...offerBase }
        : { "@type": "AggregateOffer", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length, ...offerBase };

  const listPath = product.type.listPath;
  return [
    {
      "@type": "Product",
      name: product.name,
      description: t(product.summary),
      url,
      category: t(product.type.name),
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
      { name: t(product.type.pluralName), url: localizePath(listPath, locale) },
      { name: product.name, url },
    ]),
  ].filter((entry) => entry !== null);
}

/** Metadata and page component for /products/<slug> in the request's store. */
export function productRoute() {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, slug } = await params;
    const t = getTranslator(locale as Locale, { quiet: true });
    const product = await loadProductPage(await currentStoreId(), slug);
    if (!product) return { title: `${t("Page not found")} — CMSMotive` };
    return pageMetadata({
      locale: locale as Locale,
      path: `/products/${product.slug}`,
      title: `${product.name} ${t(product.type.name)} — CMSMotive`,
      description: t(product.summary),
      image: product.cover ?? product.gallery[0] ?? null,
    });
  }

  async function Page({ params, searchParams }: Props) {
    const { locale, slug } = await params;
    const storeId = await currentStoreId();
    const product = await loadProductPage(storeId, slug);
    if (!product) notFound();
    trackPageView(storeId, `product-${product.slug}`);
    return (
      <>
        <JsonLd data={await productJsonLd(storeId, product, locale as Locale)} />
        <ProductDetail product={product} locale={locale as Locale} initialPriceId={(await searchParams).price} />
      </>
    );
  }

  return { generateMetadata, Page };
}
