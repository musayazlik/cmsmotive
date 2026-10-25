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
  searchParams: Promise<{ plan?: string }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const plan = await prisma.billingPlan.findFirst({
    where: { id: query.plan ?? "", storeId: await currentStoreId(), enabled: true },
  });
  if (!plan || (plan.kind !== "theme" && plan.kind !== "extension")) notFound();
  const product = await loadProductPage(plan.storeId, plan.kind, plan.productSlug);
  if (!product || !product.plans.some((p) => p.id === plan.id)) notFound();
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
        plans={product.plans}
        locale={locale}
        termsVersion={product.checkout.termsVersion}
        ready={product.checkout.ready}
        testMode={product.checkout.mode === "test"}
        returnPath={localizePath(`/${plan.kind}/${plan.productSlug}`, locale)}
        initialPlanId={plan.id}
      />
    </section>
  );
}
