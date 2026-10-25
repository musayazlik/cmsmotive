import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { creemMode } from "@/lib/creem";
import { releaseIsIncluded, subscriptionHasAccess } from "@/lib/billing-access";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { currentStoreId } from "@/lib/current-store";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [user, l, query] = await Promise.all([
    requireCustomer(),
    getRequestLocale(),
    searchParams,
  ]);
  const allSubscriptions = await prisma.productSubscription.findMany({
    where: { userId: user.id, mode: creemMode() },
    orderBy: { createdAt: "desc" },
  });
  // Accounts are shared; each store's account area lists that store's purchases.
  const plans = await prisma.billingPlan.findMany({
    where: { id: { in: allSubscriptions.map((s) => s.planId) }, storeId: await currentStoreId() },
  });
  const subscriptions = allSubscriptions.filter((s) => plans.some((p) => p.id === s.planId));
  const releases = await prisma.productRelease.findMany({
    where: {
      OR: plans.map((p) => ({ storeId: p.storeId, kind: p.kind, productSlug: p.productSlug })),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      productSlug: true,
      version: true,
      fileName: true,
      createdAt: true,
    },
  });
  return (
    <>
      <div className="workspace-title-row">
        <div>
          <p className="workspace-eyebrow">YOUR LIBRARY</p>
          <h1>{copy(l, "My products", "Meine Produkte", "Ürünlerim")}</h1>
          <p>
            {copy(
              l,
              "Your packages, updates and support access.",
              "Ihre Pakete, Updates und Supportberechtigungen.",
              "Paketleriniz, güncellemeleriniz ve destek erişiminiz.",
            )}
          </p>
        </div>
      </div>
      {query.checkout && (
        <p className="wfield-hint-block" role="status">
          {copy(
            l,
            "Your payment is being verified. Access appears here after confirmation from Creem. Returning from checkout alone does not confirm payment.",
            "Ihre Zahlung wird geprüft. Nach Bestätigung durch Creem erscheint der Zugriff hier. Die Rückkehr vom Checkout bestätigt keine Zahlung.",
            "Ödemeniz doğrulanıyor. Creem onayından sonra erişiminiz burada görünür. Ödeme sayfasından dönmek tek başına ödeme onayı değildir.",
          )}
        </p>
      )}
      {!subscriptions.length ? (
        <div className="wtable-card wsettings-section">
          <h2>
            {copy(
              l,
              "Your library is empty",
              "Ihre Bibliothek ist leer",
              "Henüz ürününüz yok",
            )}
          </h2>
          <p>
            {copy(
              l,
              "Purchased themes and extensions appear here after payment confirmation.",
              "Gekaufte Themes und Erweiterungen erscheinen nach Zahlungsbestätigung.",
              "Satın aldığınız tema ve eklentiler ödeme doğrulandıktan sonra burada görünür.",
            )}
          </p>
          <a
            className="wbtn wbtn-primary"
            href={l === "de" ? "/themes" : `/${l}/themes`}
          >
            {copy(l, "Explore themes", "Themes entdecken", "Temaları keşfet")}
          </a>
        </div>
      ) : (
        subscriptions.map((s) => {
          const plan = plans.find((p) => p.id === s.planId);
          if (!plan) return null;
          const files = releases.filter(
            (r) =>
              r.kind === plan.kind &&
              r.productSlug === plan.productSlug &&
              releaseIsIncluded(s, r),
          );
          return (
            <section className="wtable-card wsettings-section" key={s.id}>
              <h2>
                {plan.productSlug} · {plan.name}
              </h2>
              <p>
                {subscriptionHasAccess(s)
                  ? copy(
                      l,
                      "Updates and support active until",
                      "Updates und Support aktiv bis",
                      "Güncelleme ve destek bitişi",
                    )
                  : copy(
                      l,
                      "Subscription status",
                      "Abostatus",
                      "Abonelik durumu",
                    )}
                :{" "}
                {subscriptionHasAccess(s)
                  ? s.currentPeriodEnd.toLocaleDateString(l)
                  : s.status}
              </p>
              <p>
                {copy(
                  l,
                  "Previously delivered GPL code remains usable after cancellation. New releases and support require an active paid period.",
                  "Bereits ausgelieferter GPL-Code bleibt nach Kündigung nutzbar. Neue Versionen und Support erfordern eine aktive bezahlte Laufzeit.",
                  "Teslim edilmiş GPL kodu iptalden sonra kullanılabilir. Yeni sürümler ve destek için etkin ücretli dönem gerekir.",
                )}
              </p>
              {files.length ? (
                <ul>
                  {files.map((r) => (
                    <li key={r.id}>
                      <a
                        className="wbtn wbtn-ghost"
                        href={`/api/downloads/${r.id}`}
                      >
                        {copy(l, "Download", "Herunterladen", "İndir")} ·{" "}
                        {r.version} · {r.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {copy(
                    l,
                    "No eligible package has been uploaded yet. Contact support for delivery.",
                    "Noch kein berechtigtes Paket hochgeladen. Kontaktieren Sie den Support.",
                    "Henüz uygun paket yüklenmedi. Teslimat için destekle iletişime geçin.",
                  )}
                </p>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
