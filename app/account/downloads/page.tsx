import { Fragment } from "react";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer-auth";
import { loadCustomerDownloads } from "@/lib/customer-downloads";
import { creemMode } from "@/lib/creem";
import { getRequestLocale } from "@/lib/i18n/request";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { AccountEmpty, AccountHeading, AccountIcon } from "../account-ui";

export default async function DownloadsPage() {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  const products = await loadCustomerDownloads(user.id, creemMode());
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });
  const labels = [
    copy(l, "Product", "Produkt", "Ürün"),
    copy(l, "Version", "Version", "Sürüm"),
    copy(l, "Package file", "Paketdatei", "Paket dosyası"),
    copy(l, "Released", "Veröffentlicht", "Yayın tarihi"),
    copy(l, "Download", "Download", "İndir"),
  ];
  return (
    <>
      <AccountHeading
        title={copy(l, "My files", "Meine Dateien", "Dosyalarım")}
        description={copy(
          l,
          "All versions included in your purchases, across all stores. Previously covered versions remain available after your update period ends.",
          "Alle in Ihren Käufen enthaltenen Versionen aus allen Shops. Zuvor abgedeckte Versionen bleiben nach Ihrem Updatezeitraum verfügbar.",
          "Tüm mağazalardaki satın alımlarınıza dahil sürümler. Güncelleme döneminizdeki sürümler, dönem bittikten sonra da indirilebilir kalır.",
        )}
        action={
          <Link className="wbtn wbtn-ghost" href={`/account/products?lang=${l}`}>
            {copy(l, "My products", "Meine Produkte", "Ürünlerim")}
            <AccountIcon name="arrow" />
          </Link>
        }
      />
      {!products.length ? (
        <div className="customer-card">
          <AccountEmpty
            icon="download"
            headingLevel="h2"
            title={copy(
              l,
              "No files yet",
              "Noch keine Dateien",
              "Henüz dosyanız yok",
            )}
            description={copy(
              l,
              "Your files appear here after payment confirmation.",
              "Ihre Dateien erscheinen hier nach Zahlungsbestätigung.",
              "Dosyalarınız ödeme doğrulandıktan sonra burada görünür.",
            )}
          >
            <Link
              className="wbtn wbtn-primary"
              href={localizePath("/products", l)}
            >
              {copy(
                l,
                "Explore products",
                "Produkte entdecken",
                "Ürünleri keşfet",
              )}
            </Link>
          </AccountEmpty>
        </div>
      ) : (
        <section
          className="customer-card customer-library"
          aria-label={copy(
            l,
            "Downloadable files",
            "Herunterladbare Dateien",
            "İndirilebilir dosyalar",
          )}
        >
          <div className="customer-table-toolbar">
            <div>
              <h2>{copy(l, "Your packages", "Ihre Pakete", "Paketleriniz")}</h2>
              <span>
                {products.reduce(
                  (count, product) => count + product.files.length,
                  0,
                )}{" "}
                {copy(
                  l,
                  "files available",
                  "Dateien verfügbar",
                  "dosya indirilebilir",
                )}
              </span>
            </div>
          </div>
          <div className="customer-table-scroll">
            <table className="customer-table customer-files-table">
              <caption className="visually-hidden">
                {copy(
                  l,
                  "Purchased product versions and downloads",
                  "Gekaufte Produktversionen und Downloads",
                  "Satın alınan ürün sürümleri ve indirmeler",
                )}
              </caption>
              <thead>
                <tr>
                  {labels.map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <Fragment key={product.id}>
                    {product.files.length ? (
                      product.files.map((file, index) => (
                        <tr key={file.id}>
                          <th scope="row" data-label={labels[0]}>
                            <div className="customer-table-product">
                              <span className="customer-table-product-icon">
                                <AccountIcon name="products" />
                              </span>
                              <div>
                                <strong>{product.name}</strong>
                                <small>{product.storeName}</small>
                              </div>
                            </div>
                          </th>
                          <td data-label={labels[1]}>
                            <span className="customer-version">
                              {file.version}
                            </span>
                            {index === 0 && (
                              <small className="customer-table-subtext">
                                {copy(
                                  l,
                                  "Latest available",
                                  "Neueste verfügbare",
                                  "İndirilebilir son sürüm",
                                )}
                              </small>
                            )}
                          </td>
                          <td
                            data-label={labels[2]}
                            className="customer-file-name"
                          >
                            {file.fileName}
                          </td>
                          <td data-label={labels[3]}>
                            <time dateTime={file.createdAt.toISOString()}>
                              {date.format(file.createdAt)}
                            </time>
                          </td>
                          <td
                            data-label={labels[4]}
                            className="customer-table-actions"
                          >
                            <a
                              className={`wbtn ${index === 0 ? "wbtn-primary" : "wbtn-ghost"}`}
                              href={`/api/downloads/${file.id}`}
                              aria-label={`${labels[4]}: ${product.name} ${file.version}`}
                            >
                              <AccountIcon name="download" />
                              {copy(l, "Download", "Herunterladen", "İndir")}
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <th scope="row" data-label={labels[0]}>
                          <div className="customer-table-product">
                            <span className="customer-table-product-icon">
                              <AccountIcon name="products" />
                            </span>
                            <div>
                              <strong>{product.name}</strong>
                              <small>{product.storeName}</small>
                            </div>
                          </div>
                        </th>
                        <td
                          colSpan={4}
                          data-label={copy(l, "Status", "Status", "Durum")}
                        >
                          <p className="customer-table-subtext">
                            {product.packageCount === 0
                              ? copy(
                                  l,
                                  "No ZIP package has been uploaded yet.",
                                  "Noch kein ZIP-Paket hochgeladen.",
                                  "Henüz ZIP paketi yüklenmedi.",
                                )
                              : copy(
                                  l,
                                  "No version falls within your update period. Contact support for delivery.",
                                  "Keine Version liegt in Ihrem Updatezeitraum. Kontaktieren Sie den Support.",
                                  "Güncelleme döneminize dahil bir sürüm yok. Teslimat için destekle iletişime geçin.",
                                )}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
