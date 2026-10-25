import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { creemMode } from "@/lib/creem";
import { entitlementCovers, entitlementReceivesUpdates } from "@/lib/billing-access";
import { getRequestLocale } from "@/lib/i18n/request";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { currentStoreId } from "@/lib/current-store";

/** The account's library in this store: every purchase or subscription, its downloads and licence keys. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [user, l, query, storeId] = await Promise.all([
    requireCustomer(),
    getRequestLocale(),
    searchParams,
    currentStoreId(),
  ]);
  // Accounts are shared; each store's account area lists that store's purchases.
  const entitlements = await prisma.entitlement.findMany({
    where: { storeId, customer: { userId: user.id, mode: creemMode() } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
          type: { select: { name: true } },
          releases: { orderBy: { createdAt: "desc" }, select: { id: true, version: true, fileName: true, createdAt: true } },
        },
      },
      order: { select: { price: { select: { name: true } } } },
      subscription: { select: { status: true, currentPeriodEnd: true, price: { select: { name: true } } } },
      licenseKeys: { orderBy: { createdAt: "asc" }, select: { id: true, key: true, status: true, activations: true, activationLimit: true, expiresAt: true } },
    },
  });
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });

  return (
    <>
      <div className="workspace-title-row">
        <div>
          <p className="workspace-eyebrow">YOUR LIBRARY</p>
          <h1>{copy(l, "My products", "Meine Produkte", "Ürünlerim")}</h1>
          <p>
            {copy(
              l,
              "Your packages, updates, licence keys and support access.",
              "Ihre Pakete, Updates, Lizenzschlüssel und Supportberechtigungen.",
              "Paketleriniz, güncellemeleriniz, lisans anahtarlarınız ve destek erişiminiz.",
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
      {!entitlements.length ? (
        <div className="wtable-card wsettings-section">
          <h2>{copy(l, "Your library is empty", "Ihre Bibliothek ist leer", "Henüz ürününüz yok")}</h2>
          <p>
            {copy(
              l,
              "Purchased products appear here after payment confirmation.",
              "Gekaufte Produkte erscheinen nach Zahlungsbestätigung.",
              "Satın aldığınız ürünler ödeme doğrulandıktan sonra burada görünür.",
            )}
          </p>
          <a className="wbtn wbtn-primary" href={localizePath("/products", l)}>
            {copy(l, "Explore products", "Produkte entdecken", "Ürünleri keşfet")}
          </a>
        </div>
      ) : (
        entitlements.map((entitlement) => {
          const { product } = entitlement;
          const files = product.releases.filter((release) => entitlementCovers(entitlement, release));
          const planName = entitlement.subscription?.price.name ?? entitlement.order?.price.name ?? "";
          const updates = entitlementReceivesUpdates(entitlement);
          return (
            <section className="wtable-card wsettings-section" key={entitlement.id}>
              <h2>
                {product.name}
                {planName ? ` · ${planName}` : ""}
              </h2>
              <p>
                {entitlement.revokedAt
                  ? copy(
                      l,
                      "This purchase was refunded or disputed; its downloads are no longer available.",
                      "Dieser Kauf wurde erstattet oder angefochten; seine Downloads sind nicht mehr verfügbar.",
                      "Bu satın alma iade edildi veya itiraz edildi; indirmeleri artık kullanılamaz.",
                    )
                  : entitlement.updatesUntil === null
                    ? copy(l, "Lifetime updates included.", "Lebenslange Updates inklusive.", "Ömür boyu güncelleme dahil.")
                    : updates
                      ? `${copy(l, "Updates and support until", "Updates und Support bis", "Güncelleme ve destek bitişi")} ${date.format(entitlement.updatesUntil)}`
                      : `${copy(l, "Updates ended on", "Updates endeten am", "Güncellemeler şu tarihte sona erdi:")} ${date.format(entitlement.updatesUntil)}`}
                {entitlement.subscription && !entitlement.revokedAt
                  ? ` · ${copy(l, "Subscription", "Abonnement", "Abonelik")}: ${entitlement.subscription.status}`
                  : ""}
              </p>
              {!entitlement.revokedAt && (
                <p>
                  {copy(
                    l,
                    "Versions delivered while your updates were active stay downloadable. New releases need active updates.",
                    "Während aktiver Updates gelieferte Versionen bleiben herunterladbar. Neue Versionen erfordern aktive Updates.",
                    "Güncellemeleriniz etkinken teslim edilen sürümler indirilebilir kalır. Yeni sürümler için etkin güncelleme gerekir.",
                  )}
                </p>
              )}
              {entitlement.licenseKeys.length > 0 && (
                <div className="waccount-licences">
                  <p className="wsection-label">{copy(l, "Licence keys", "Lizenzschlüssel", "Lisans anahtarları")}</p>
                  <ul>
                    {entitlement.licenseKeys.map((licence) => (
                      <li key={licence.id}>
                        <code>{licence.key}</code> · {licence.status} · {licence.activations}
                        {licence.activationLimit !== null ? ` / ${licence.activationLimit}` : ""}{" "}
                        {copy(l, "activations", "Aktivierungen", "etkinleştirme")}
                        {licence.expiresAt ? ` · ${copy(l, "expires", "läuft ab", "bitiş")} ${date.format(licence.expiresAt)}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {entitlement.revokedAt ? null : files.length ? (
                <ul>
                  {files.map((release) => (
                    <li key={release.id}>
                      <a className="wbtn wbtn-ghost" href={`/api/downloads/${release.id}`}>
                        {copy(l, "Download", "Herunterladen", "İndir")} · {release.version} · {release.fileName}
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
