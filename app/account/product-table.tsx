"use client";

import { Fragment, useId, useState } from "react";
import type { CustomerLibraryItem } from "@/lib/customer-library";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import { AccountIcon } from "./account-ui";

export default function ProductTable({
  products,
  locale: l,
}: {
  products: CustomerLibraryItem[];
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const id = useId();
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });
  const format = (iso: string) => date.format(new Date(iso));
  const visible = products.filter((product) =>
    `${product.name} ${product.plan} ${product.store}`
      .toLocaleLowerCase(LOCALE_TAGS[l])
      .includes(search.toLocaleLowerCase(LOCALE_TAGS[l])),
  );
  const download = copy(l, "Download", "Herunterladen", "İndir");
  const unavailable = copy(
    l,
    "Unavailable",
    "Nicht verfügbar",
    "Kullanılamıyor",
  );
  const status = (product: CustomerLibraryItem) =>
    product.revoked
      ? unavailable
      : product.updatesActive
        ? copy(l, "Updates active", "Updates aktiv", "Güncellemeler aktif")
        : copy(
            l,
            "Updates ended",
            "Updates beendet",
            "Güncelleme süresi doldu",
          );

  return (
    <section
      className="customer-card customer-library"
      aria-label={copy(
        l,
        "Purchased products",
        "Gekaufte Produkte",
        "Satın alınan ürünler",
      )}
    >
      <div className="customer-table-toolbar">
        <div>
          <h2>
            {copy(l, "Your purchases", "Ihre Käufe", "Satın aldıklarınız")}
          </h2>
          <span>
            {visible.length} / {products.length}{" "}
            {copy(l, "packages", "Pakete", "paket")}
          </span>
        </div>
        <label className="customer-table-search">
          <span className="visually-hidden">
            {copy(l, "Search products", "Produkte suchen", "Ürün ara")}
          </span>
          <AccountIcon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy(
              l,
              "Search products or plans…",
              "Produkte oder Tarife suchen…",
              "Ürün veya paket ara…",
            )}
          />
        </label>
      </div>
      <div className="customer-table-scroll">
        <table className="customer-table customer-product-table">
          <caption className="visually-hidden">
            {copy(
              l,
              "Products, update coverage, latest versions and downloads",
              "Produkte, Updateberechtigung, aktuelle Versionen und Downloads",
              "Ürünler, güncelleme hakları, son sürümler ve indirmeler",
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {copy(l, "Product & plan", "Produkt & Tarif", "Ürün ve paket")}
              </th>
              <th scope="col">
                {copy(
                  l,
                  "Update access",
                  "Updateberechtigung",
                  "Güncelleme hakkı",
                )}
              </th>
              <th scope="col">
                {copy(l, "Latest version", "Neueste Version", "Son sürüm")}
              </th>
              <th scope="col">
                {copy(l, "Last update", "Letztes Update", "Son güncelleme")}
              </th>
              <th scope="col">{copy(l, "Actions", "Aktionen", "İşlemler")}</th>
            </tr>
          </thead>
          <tbody>
            {!visible.length && (
              <tr>
                <td colSpan={5} className="customer-table-empty">
                  {copy(
                    l,
                    "No matching products.",
                    "Keine passenden Produkte.",
                    "Eşleşen ürün bulunamadı.",
                  )}
                </td>
              </tr>
            )}
            {visible.map((product) => {
              const latest = product.releases[0];
              const eligible = product.releases.find(
                (release) => release.available,
              );
              const open = expanded === product.id;
              const detailId = `${id}-${product.id}`;
              return (
                <Fragment key={product.id}>
                  <tr className={open ? "customer-row-open" : undefined}>
                    <th
                      scope="row"
                      data-label={copy(
                        l,
                        "Product & plan",
                        "Produkt & Tarif",
                        "Ürün ve paket",
                      )}
                    >
                      <div className="customer-table-product">
                        <span className="customer-table-product-icon">
                          <AccountIcon name="products" />
                        </span>
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.plan || product.type}</span>
                          <small>{product.store}</small>
                        </div>
                      </div>
                    </th>
                    <td
                      data-label={copy(
                        l,
                        "Update access",
                        "Updateberechtigung",
                        "Güncelleme hakkı",
                      )}
                    >
                      <span
                        className="customer-status"
                        data-positive={product.updatesActive}
                      >
                        {status(product)}
                      </span>
                      <small className="customer-table-subtext">
                        {product.revoked
                          ? copy(
                              l,
                              "Purchase reversed",
                              "Kauf rückabgewickelt",
                              "Satın alma iptal edildi",
                            )
                          : product.updatesUntil
                            ? `${copy(l, "Until", "Bis", "Bitiş")} ${format(product.updatesUntil)}`
                            : copy(
                                l,
                                "Lifetime updates",
                                "Lebenslange Updates",
                                "Ömür boyu güncelleme",
                              )}
                      </small>
                      {product.renewPriceId && (
                        <a className="customer-renew-link" href={`/account/checkout?price=${encodeURIComponent(product.renewPriceId)}&lang=${l}`}>
                          {product.subscriptionStatus
                            ? copy(l, "Restart subscription", "Abonnement neu starten", "Aboneliği yeniden başlat")
                            : copy(l, "Renew updates", "Updates verlängern", "Güncellemeleri yenile")}
                          <AccountIcon name="arrow" />
                        </a>
                      )}
                    </td>
                    <td
                      data-label={copy(
                        l,
                        "Latest version",
                        "Neueste Version",
                        "Son sürüm",
                      )}
                    >
                      <span className="customer-version">
                        {latest?.version ?? "—"}
                      </span>
                      {latest && !latest.available && !product.revoked && (
                        <small className="customer-table-subtext customer-text-warning">
                          {copy(
                            l,
                            "Outside your update period",
                            "Außerhalb Ihres Updatezeitraums",
                            "Güncelleme kapsamı dışında",
                          )}
                        </small>
                      )}
                    </td>
                    <td
                      data-label={copy(
                        l,
                        "Last update",
                        "Letztes Update",
                        "Son güncelleme",
                      )}
                    >
                      {latest ? (
                        <time dateTime={latest.createdAt}>
                          {format(latest.createdAt)}
                        </time>
                      ) : (
                        <span className="customer-table-subtext">
                          {copy(
                            l,
                            "No release yet",
                            "Noch keine Version",
                            "Henüz sürüm yok",
                          )}
                        </span>
                      )}
                    </td>
                    <td
                      className="customer-table-actions"
                      data-label={copy(l, "Actions", "Aktionen", "İşlemler")}
                    >
                      <div className="customer-row-actions">
                        {eligible ? (
                          <a
                            className="wbtn wbtn-primary"
                            href={`/api/downloads/${eligible.id}`}
                            aria-label={`${download}: ${product.name} ${eligible.version}`}
                          >
                            <AccountIcon name="download" />
                            {download}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="wbtn wbtn-ghost"
                            disabled
                          >
                            {product.revoked
                              ? unavailable
                              : copy(
                                  l,
                                  "No package",
                                  "Kein Paket",
                                  "Paket yok",
                                )}
                          </button>
                        )}
                        <button
                          className="wbtn wbtn-ghost customer-details-toggle"
                          type="button"
                          aria-expanded={open}
                          aria-controls={open ? detailId : undefined}
                          onClick={() => setExpanded(open ? null : product.id)}
                        >
                          {copy(l, "Details", "Details", "Detaylar")}
                          <AccountIcon name="chevron" />
                        </button>
                      </div>
                      {eligible && latest?.id !== eligible.id && (
                        <small className="customer-table-subtext">
                          {copy(l, "Available", "Verfügbar", "İndirilebilir")}:{" "}
                          {eligible.version}
                        </small>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="customer-detail-row">
                      <td colSpan={5}>
                        <div id={detailId} className="customer-product-details">
                          <div className="customer-detail-grid">
                            <section>
                              <h3>
                                {copy(
                                  l,
                                  "Your package includes",
                                  "Ihr Paket enthält",
                                  "Paketinize dahil olanlar",
                                )}
                              </h3>
                              <p>{product.summary}</p>
                              <ul className="customer-feature-list">
                                <li>
                                  {product.seats}{" "}
                                  {copy(
                                    l,
                                    "supported installations",
                                    "unterstützte Installationen",
                                    "kurulum için destek",
                                  )}
                                </li>
                                {product.features.map((feature, index) => (
                                  <li key={index}>{feature}</li>
                                ))}
                              </ul>
                              {product.technologies.length > 0 && (
                                <div className="customer-tech-list">
                                  {product.technologies.map((technology) => (
                                    <span key={technology}>{technology}</span>
                                  ))}
                                </div>
                              )}
                              <p className="customer-table-subtext">
                                {copy(l, "Purchased", "Gekauft", "Satın alma")}:{" "}
                                {format(product.purchasedAt)}
                              </p>
                            </section>
                            <section>
                              <h3>
                                {copy(
                                  l,
                                  "Licence & delivery",
                                  "Lizenz & Lieferung",
                                  "Lisans ve teslimat",
                                )}
                              </h3>
                              {product.revoked ? (
                                <p>
                                  {copy(
                                    l,
                                    "Downloads and licence keys are unavailable because this purchase was refunded or disputed.",
                                    "Downloads und Lizenzschlüssel sind nach Erstattung oder Zahlungsstreit nicht verfügbar.",
                                    "Bu satın alma iade edildiği veya ödemeye itiraz edildiği için indirmeler ve lisans anahtarları kullanılamıyor.",
                                  )}
                                </p>
                              ) : (
                                <>
                                  {product.licenses.length ? (
                                    product.licenses.map((license) => (
                                      <div
                                        className="customer-license"
                                        key={license.id}
                                      >
                                        <code>{license.key}</code>
                                        <span>
                                          {license.status}
                                          {license.activations !== null
                                            ? ` · ${license.activations}${license.limit !== null ? ` / ${license.limit}` : ""} ${copy(l, "activations", "Aktivierungen", "etkinleştirme")}`
                                            : license.limit !== null
                                              ? ` · ${license.limit} ${copy(l, "installations", "Installationen", "kurulum")}`
                                              : ""}
                                          {license.expiresAt
                                            ? ` · ${format(license.expiresAt)}`
                                            : ""}
                                        </span>
                                        {license.manageable && (
                                          <a className="customer-renew-link" href={`/account/licenses/${license.id}?lang=${l}`}>
                                            {copy(l, "Manage installations", "Installationen verwalten", "Kurulumları yönet")}
                                            <AccountIcon name="arrow" />
                                          </a>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <p>
                                      {copy(
                                        l,
                                        "No separate licence key was issued for this purchase.",
                                        "Für diesen Kauf wurde kein separater Lizenzschlüssel ausgestellt.",
                                        "Bu satın alma için ayrı bir lisans anahtarı oluşturulmadı.",
                                      )}
                                    </p>
                                  )}
                                  {eligible?.license && (
                                    <p>
                                      {copy(
                                        l,
                                        "Code license",
                                        "Code-Lizenz",
                                        "Kod lisansı",
                                      )}
                                      : {eligible.license}
                                    </p>
                                  )}
                                  {product.deliveryNote && (
                                    <p className="customer-delivery-note">
                                      {product.deliveryNote}
                                    </p>
                                  )}
                                </>
                              )}
                            </section>
                          </div>
                          <section className="customer-version-history">
                            <h3>
                              {copy(
                                l,
                                "Versions & downloads",
                                "Versionen & Downloads",
                                "Sürümler ve indirmeler",
                              )}
                            </h3>
                            <p>
                              {copy(
                                l,
                                "Versions covered by your update period remain downloadable after it ends.",
                                "Versionen aus Ihrem Updatezeitraum bleiben auch danach herunterladbar.",
                                "Güncelleme döneminizdeki sürümler, dönem sona erdikten sonra da indirilebilir kalır.",
                              )}
                            </p>
                            {product.releases.length ? (
                              <ul>
                                {product.releases.map((release, index) => (
                                  <li key={release.id}>
                                    <div>
                                      <strong>
                                        {release.version}
                                        {index === 0 && (
                                          <span className="customer-status">
                                            {copy(
                                              l,
                                              "Latest",
                                              "Aktuell",
                                              "Son sürüm",
                                            )}
                                          </span>
                                        )}
                                      </strong>
                                      <span>{release.fileName}</span>
                                    </div>
                                    <time dateTime={release.createdAt}>
                                      {format(release.createdAt)}
                                    </time>
                                    {release.available ? (
                                      <a
                                        className="wbtn wbtn-ghost"
                                        href={`/api/downloads/${release.id}`}
                                        aria-label={`${download}: ${product.name} ${release.version}`}
                                      >
                                        <AccountIcon name="download" />
                                        {download}
                                      </a>
                                    ) : (
                                      <span className="customer-table-subtext">
                                        {unavailable}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>
                                {copy(
                                  l,
                                  "No package has been uploaded yet. Contact support for delivery.",
                                  "Noch kein Paket hochgeladen. Kontaktieren Sie den Support.",
                                  "Henüz paket yüklenmedi. Teslimat için destekle iletişime geçin.",
                                )}
                              </p>
                            )}
                          </section>
                          {product.changelog.length > 0 && (
                            <section className="customer-release-notes">
                              <h3>
                                {copy(
                                  l,
                                  "Recent update notes",
                                  "Letzte Update-Hinweise",
                                  "Son güncelleme notları",
                                )}
                              </h3>
                              {product.changelog.map((entry) => (
                                <article key={entry.id}>
                                  <header>
                                    <strong>
                                      {entry.version} · {entry.title}
                                    </strong>
                                    <time dateTime={entry.releasedAt}>
                                      {format(entry.releasedAt)}
                                    </time>
                                  </header>
                                  <ul>
                                    {entry.changes.map((change, index) => (
                                      <li key={index}>{change.text}</li>
                                    ))}
                                  </ul>
                                </article>
                              ))}
                            </section>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
