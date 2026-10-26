import Link from "next/link";
import { requireCustomer } from "@/lib/customer-auth";
import { loadCustomerLibrary } from "@/lib/customer-library";
import { creemMode } from "@/lib/creem";
import { getRequestLocale } from "@/lib/i18n/request";
import { localizePath } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { AccountEmpty, AccountHeading, AccountIcon } from "../account-ui";
import ProductTable from "../product-table";

/** Shared account library, including the buyer's purchases from every store. */
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
  const products = await loadCustomerLibrary(user.id, creemMode());
  return (
    <>
      <AccountHeading
        title={copy(l, "My products", "Meine Produkte", "Ürünlerim")}
        description={copy(
          l,
          "Your purchased plans, updates, licence keys and downloads in one place.",
          "Ihre gekauften Tarife, Updates, Lizenzschlüssel und Downloads an einem Ort.",
          "Satın aldığınız paketler, güncellemeler, lisans anahtarları ve indirmeler tek yerde.",
        )}
        action={
          <Link
            className="wbtn wbtn-ghost"
            href={`/account/downloads?lang=${l}`}
          >
            <AccountIcon name="download" />
            {copy(l, "My files", "Meine Dateien", "Dosyalarım")}
          </Link>
        }
      />
      {query.checkout && (
        <div className="customer-notice" role="status">
          <AccountIcon name="shield" />
          <p>
            {copy(
              l,
              "Your payment is being verified. Access appears after confirmation from Creem; returning from checkout alone does not confirm payment.",
              "Ihre Zahlung wird geprüft. Zugriff erscheint nach Bestätigung durch Creem; die Rückkehr vom Checkout bestätigt keine Zahlung.",
              "Ödemeniz doğrulanıyor. Erişiminiz Creem onayından sonra görünür; ödeme sayfasından dönmek tek başına ödeme onayı değildir.",
            )}
          </p>
        </div>
      )}
      {!products.length ? (
        <div className="customer-card customer-empty-library">
          <AccountEmpty
            icon="products"
            headingLevel="h2"
            title={copy(
              l,
              "Your library is empty",
              "Ihre Bibliothek ist leer",
              "Henüz ürününüz yok",
            )}
            description={copy(
              l,
              "Purchased products appear here after payment confirmation.",
              "Gekaufte Produkte erscheinen nach Zahlungsbestätigung.",
              "Satın aldığınız ürünler ödeme doğrulandıktan sonra burada görünür.",
            )}
          >
            <a
              className="wbtn wbtn-primary"
              href={localizePath("/products", l)}
            >
              {copy(
                l,
                "Explore products",
                "Produkte entdecken",
                "Ürünleri keşfet",
              )}
              <AccountIcon name="arrow" />
            </a>
          </AccountEmpty>
        </div>
      ) : (
        <>
          <div className="customer-summary customer-library-summary">
            <div className="customer-summary-item">
              <AccountIcon name="products" />
              <div>
                <span>
                  {copy(
                    l,
                    "Purchased packages",
                    "Gekaufte Pakete",
                    "Satın alınan paketler",
                  )}
                </span>
                <strong>{products.length}</strong>
              </div>
            </div>
            <div className="customer-summary-item">
              <AccountIcon name="shield" />
              <div>
                <span>
                  {copy(
                    l,
                    "Active update plans",
                    "Aktive Update-Tarife",
                    "Güncellemesi aktif",
                  )}
                </span>
                <strong>
                  {products.filter((product) => product.updatesActive).length}
                </strong>
              </div>
            </div>
            <div className="customer-summary-item">
              <AccountIcon name="download" />
              <div>
                <span>
                  {copy(
                    l,
                    "Packages ready to download",
                    "Pakete zum Download",
                    "İndirilebilir paketler",
                  )}
                </span>
                <strong>
                  {
                    products.filter((product) =>
                      product.releases.some((release) => release.available),
                    ).length
                  }
                </strong>
              </div>
            </div>
          </div>
          <ProductTable products={products} locale={l} />
        </>
      )}
    </>
  );
}
