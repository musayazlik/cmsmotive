import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadProductPage } from "@/lib/product-page";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import { localizePath } from "@/lib/i18n/config";
import ProductCheckoutForm from "@/app/_components/product-checkout-form";
import { currentStoreId } from "@/lib/current-store";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const price = await prisma.price.findFirst({
    where: { id: query.price ?? "", enabled: true, product: { storeId: await currentStoreId() } },
    select: { id: true, product: { select: { slug: true, storeId: true } } },
  });
  if (!price) notFound();
  const product = await loadProductPage(price.product.storeId, price.product.slug);
  if (!product || !product.prices.some((p) => p.id === price.id)) notFound();
  return (
    <section className="wtable-card wsettings-section">
      <h1>{product.name}</h1>
      <p>
        {copy(
          locale,
          "Card details are entered only on Creem's secure payment page. Creem issues the invoice.",
          "Kartendaten werden nur auf der sicheren Creem-Zahlungsseite eingegeben. Creem stellt die Rechnung aus.",
          "Kart bilgileri yalnız Creem'in güvenli ödeme sayfasında girilir. Faturayı Creem düzenler.",
        )}
      </p>
      <ProductCheckoutForm
        prices={product.prices}
        locale={locale}
        termsVersion={product.checkout.termsVersion}
        ready={product.checkout.ready}
        testMode={product.checkout.mode === "test"}
        returnPath={localizePath(`/products/${product.slug}`, locale)}
        initialPriceId={price.id}
      />
    </section>
  );
}
