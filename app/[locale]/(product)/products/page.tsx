import type { Metadata } from "next";
import { listProducts, productCard, themePlaceholder } from "@/lib/catalog";
import { currentStoreId } from "@/lib/current-store";
import { localizePath, type Locale } from "@/lib/i18n/config";
import { localizeLegacyHtml } from "@/lib/i18n/legacy";
import { getTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";
import { trackPageView } from "@/lib/analytics";
import { SiteFrame } from "../../_components/site-chrome";
import { VISIBLE_STATUSES } from "@/lib/catalog-guard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> };

/** Product types that have products in the store, in their panel order. */
async function storeTypes(storeId: string) {
  return prisma.productType.findMany({
    where: { products: { some: { storeId, status: { in: VISIBLE_STATUSES } } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { key: true, name: true, pluralName: true },
  });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = getTranslator(locale, { quiet: true });
  const { type } = await searchParams;
  const types = await storeTypes(await currentStoreId());
  const current = types.find((entry) => entry.key === type);
  return pageMetadata({
    locale,
    path: current ? `/products?type=${current.key}` : "/products",
    title: `${current ? t(current.pluralName) : t("Products")} — CMSMotive`,
    description: t("Documented, source-delivered products from CMSMotive."),
  });
}

/** The store's whole catalogue, filterable by product type (/products?type=<key>). */
export default async function ProductsPage({ params, searchParams }: Props) {
  const locale = (await params).locale as Locale;
  const t = getTranslator(locale);
  const c = getTranslator(locale, { quiet: true });
  const href = (path: string) => localizePath(path, locale);
  const storeId = await currentStoreId();
  const { type } = await searchParams;
  const [types, products] = await Promise.all([storeTypes(storeId), listProducts(storeId)]);
  const current = types.find((entry) => entry.key === type);
  const shown = current ? products.filter((product) => product.type.key === current.key) : products;
  trackPageView(storeId, current ? `products-${current.key}` : "products");

  // Same cards as the home page; copy matching the catalog is translated, links keep the language.
  const grid = localizeLegacyHtml(
    shown.map((product) => productCard(product, true)).join("") + (shown.length ? "" : themePlaceholder().repeat(3)),
    locale,
    "/products",
  );

  return (
    <SiteFrame locale={locale} path="/products" current="/products">
      <section className="page-hero">
        <div className="container">
          <div className="crumbs">
            <a href={href("/")}>{t("Home")}</a>
            <span>/</span>
            {current ? (
              <>
                <a href={href("/products")}>{c("Products")}</a>
                <span>/</span>
                <span>{c(current.pluralName)}</span>
              </>
            ) : (
              <span>{c("Products")}</span>
            )}
          </div>
          <span className="eyebrow">{c("The collection")}</span>
          <h1>
            {current ? c(current.pluralName) : c("Products")}
            <em>.</em>
          </h1>
          <p className="hero-sub">{c("Documented, source-delivered products from CMSMotive.")}</p>
        </div>
      </section>
      <section className="section-sm">
        <div className="container">
          {types.length > 1 ? (
            <nav className="product-type-filter" aria-label={c("Product types")}>
              <a href={href("/products")} aria-current={current ? undefined : "page"}>
                {c("All")}
              </a>
              {types.map((entry) => (
                <a key={entry.key} href={`${href("/products")}?type=${entry.key}`} aria-current={current?.key === entry.key ? "page" : undefined}>
                  {c(entry.pluralName)}
                </a>
              ))}
            </nav>
          ) : null}
          <div className="product-grid" dangerouslySetInnerHTML={{ __html: grid }} />
        </div>
      </section>
    </SiteFrame>
  );
}
