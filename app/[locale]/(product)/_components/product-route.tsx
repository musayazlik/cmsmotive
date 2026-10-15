import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { localizePath, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translate";
import { loadProductPage, type ProductKind } from "@/lib/product-page";
import ProductDetail from "./product-detail";

type Props = { params: Promise<{ locale: string; slug: string }> };

const KIND_LABEL: Record<ProductKind, string> = { theme: "TYPO3 theme", extension: "TYPO3 extension" };

/** Metadata and page component for /theme/<slug> and /extension/<slug>. */
export function productRoute(kind: ProductKind) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, slug } = await params;
    const t = getTranslator(locale as Locale, { quiet: true });
    const product = await loadProductPage(kind, slug);
    if (!product) return { title: `${t("Page not found")} — CMSMotive` };
    const path = `/${kind}/${product.slug}`;
    return {
      title: `${product.name} ${t(KIND_LABEL[kind])} — CMSMotive`,
      description: t(product.summary),
      openGraph: product.cover ? { images: [{ url: product.cover.url }] } : undefined,
      alternates: {
        languages: { de: localizePath(path, "de"), en: localizePath(path, "en"), tr: localizePath(path, "tr"), "x-default": path },
      },
    };
  }

  async function Page({ params }: Props) {
    const { locale, slug } = await params;
    const product = await loadProductPage(kind, slug);
    if (!product) notFound();
    // Same analytics keys as the static theme-<slug> pages these replace.
    trackPageView(`${kind}-${product.slug}`);
    return <ProductDetail product={product} locale={locale as Locale} />;
  }

  return { generateMetadata, Page };
}
