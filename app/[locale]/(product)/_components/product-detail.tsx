import { copy } from "@/lib/legal-copy";
import { Fragment, type ReactNode } from "react";
import Script from "next/script";
import { LOCALE_TAGS, SOURCE_LOCALE, localizePath, type Locale } from "@/lib/i18n/config";
import { loadAppCatalog } from "@/lib/i18n/catalog";
import { translateHtml } from "@/lib/i18n/html";
import { getTranslator, type Translate } from "@/lib/i18n/translate";
import type { ProductPageData, PublicPrice } from "@/lib/product-page";
import { billingSuffix, formatAmount } from "@/lib/prices";
import { SiteFrame } from "../../_components/site-chrome";
import ProductCheckoutForm from "@/app/_components/product-checkout-form";

/**
 * Product detail page (/products/<slug>), built from what /panel stores: hero,
 * cover and gallery, the Description / Compatibility / Reviews / Changelog
 * tabs and the product box. The markup mirrors the static product pages
 * (product.css styles it, product.js runs the tabs, reviews and licence
 * picker). Interface copy comes from the catalog; panel copy is translated
 * wherever it matches English catalog text and is shown as written otherwise.
 */

const STATUS_LABELS: Record<string, string> = {
  preview: "Preview concept",
  published: "Available now",
};

const CHANGE_LABELS: Record<string, string> = { new: "New", improved: "Improved", fixed: "Fixed" };

const CHANGELOG_NOTE =
  "Concept milestones from the design phase. Versioned release notes with upgrade instructions will follow with the first package.";

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <span className="btn-icon" aria-hidden="true">
      <img src={`/assets/icons/${up ? "arrow-up-right" : "arrow-right"}.svg`} alt="" width={16} height={16} />
    </span>
  );
}

function Button({ href, kind = "primary", up, children }: { href: string; kind?: "primary" | "outline"; up?: boolean; children: ReactNode }) {
  const external = /^https?:\/\//i.test(href);
  return (
    <a className={`btn btn-${kind}`} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span className="btn-label">{children}</span>
      <Arrow up={up} />
    </a>
  );
}

function PanelHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="product-panel-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function ReviewsPanel({ product, t, locale }: { product: ProductPageData; t: Translate; locale: Locale }) {
  const { name } = product;
  return (
    <>
      <PanelHead
        eyebrow={t("Customer reviews")}
        title={t("What teams say about {name}.", { name })}
        text={copy(locale,"Reviews are moderated. Purchases and actual product use are not independently verified unless explicitly stated.","Bewertungen werden moderiert. Kauf und tatsächliche Nutzung werden ohne ausdrücklichen Hinweis nicht unabhängig verifiziert.","Değerlendirmeler denetlenir. Aksi belirtilmedikçe satın alma ve gerçek ürün kullanımı bağımsız olarak doğrulanmaz.")}
      />
      <div className="review-layout" data-reviews data-product={product.slug} data-product-type={product.type.key}>
        <aside className="review-summary" aria-label={t("Rating summary")}>
          <div className="review-score">
            <strong data-review-average>–</strong>
            <span className="review-stars" data-review-average-stars role="img" aria-label={t("No reviews yet")} />
            <p data-review-total>{t("No reviews yet")}</p>
          </div>
          <ul className="review-bars">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n}>
                <span>{n} ★</span>
                <span className="review-bar">
                  <i data-review-bar={n} />
                </span>
                <span data-review-bar-count={n}>0</span>
              </li>
            ))}
          </ul>
          <a className="btn btn-outline review-write" href="#write-review">
            <span className="btn-label">{t("Write a review")}</span>
            <Arrow />
          </a>
        </aside>
        <div className="review-feed">
          <div className="review-empty" data-review-empty hidden>
            <strong>{t("No reviews yet.")}</strong>
            <p>{t("Be the first to share how {name} works for your team.", { name })}</p>
          </div>
          <ol className="review-list" data-review-list />
          <button className="btn btn-outline review-more" type="button" data-review-more hidden>
            <span className="btn-label">{t("Show more reviews")}</span>
          </button>
        </div>
      </div>
      <div className="contact-form-card review-form-card" id="write-review">
        <span className="eyebrow">{t("Write a review")}</span>
        <h2>{t("Share your experience with {name}.", { name })}</h2>
        <p>{t("No account needed. Reviews are published once our team has approved them, and your email address is never shown.")}</p>
        <form className="contact-form" data-review-form noValidate>
          <fieldset className="review-rating">
            <legend>{t("Your rating")}</legend>
            <div className="review-rating-stars">
              {[5, 4, 3, 2, 1].map((n) => {
                const label = t(n === 1 ? "1 star" : `${n} stars`);
                // Input and label stay siblings: product.css styles the stars with `input + label`.
                return (
                  <Fragment key={n}>
                    <input type="radio" id={`rating-${n}`} name="rating" value={n} />
                    <label htmlFor={`rating-${n}`} title={label}>
                      <span aria-hidden="true">★</span>
                      <span className="review-sr">{label}</span>
                    </label>
                  </Fragment>
                );
              })}
            </div>
            <span className="review-rating-hint" data-review-rating-hint aria-live="polite" />
          </fieldset>
          <div className="contact-form-row">
            <div className="contact-field">
              <label htmlFor="review-name">{t("Full name")}</label>
              <input id="review-name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} placeholder={t("First and last name")} />
            </div>
            <div className="contact-field">
              <label htmlFor="review-email">{t("Email")}</label>
              <input id="review-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" />
            </div>
          </div>
          <div className="contact-field">
            <label htmlFor="review-body">{t("Your review")}</label>
            <textarea id="review-body" name="body" required minLength={10} maxLength={2000} rows={5} placeholder={t("What stood out, and who would you recommend it to?")} />
            <span className="review-counter" data-review-counter aria-hidden="true">
              0 / 2,000
            </span>
          </div>
          <div className="review-honeypot" aria-hidden="true">
            <label htmlFor="review-website">{t("Website")}</label>
            <input id="review-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <p className="review-captcha-note">
            {t("Protected by Google reCAPTCHA:")}{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              {t("Privacy Policy")}
            </a>{" "}
            ·{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
              {t("Terms of Service")}
            </a>
          </p>
          <div className="contact-form-bottom">
            <button className="btn btn-primary" type="submit">
              <span className="btn-label">{t("Submit review")}</span>
              <Arrow />
            </button>
          </div>
          <p className="contact-form-status" data-review-status role="status" aria-live="polite" hidden />
        </form>
      </div>
    </>
  );
}

/** Price, price picker, buttons and highlight lines in the sticky product box. */
function BuyPanel({ product, t, c, href, locale, initialPriceId }: { product: ProductPageData; t: Translate; c: Translate; href: (path: string) => string; locale: Locale; initialPriceId?: string }) {
  const { name } = product;
  const published = product.status === "published";
  const hasCheckout = product.prices.length > 0 && (published || product.checkout.mode === "test");
  const badges: [string, string][] = [];
  if (product.technologies.length > 0) badges.push([product.technologies.join(" / "), "orange"]);
  if (published) badges.push([t("Available"), "green"]);
  else if (product.badge) badges.push([c(product.badge), ""]);

  // Before anything can be bought: the store's prices as indicative options, else the list price.
  const tag = LOCALE_TAGS[locale];
  const options = product.indicativePrices;
  const first: PublicPrice | undefined = options[0];
  const display = (price: PublicPrice) => formatAmount(price.amountCents, price.currency, tag);
  const priceText = !first ? t("TBD") : first.amountCents === 0 ? t("Free") : display(first);
  const priceLabel = !first ? t("Roadmap price") : first.amountCents === 0 ? t("Planned price") : published ? t("Price") : t("Indicative concept price");
  const suffix = first ? billingSuffix(first) : "";
  const ctaUrl = product.ctaUrl ?? "/contact";

  return (
    <aside className="buy-panel" aria-label={t("{name} product information", { name })}>
      <span className="badge indigo">{product.status !== "published" && product.badge ? c(product.badge) : t(STATUS_LABELS[product.status] ?? "Preview concept")}</span>
      <h2>{name}</h2>
      <p>{c(product.summary)}</p>
      {badges.length > 0 ? (
        <div className="badge-row">
          {badges.map(([text, tone]) => (
            <span key={text} className={`badge ${tone}`}>
              {text}
            </span>
          ))}
        </div>
      ) : null}
      {!hasCheckout && first ? (
        <div className="buy-price">
          <small>{priceLabel}</small>
          <span id="licence-price">{priceText}</span>
          {suffix ? <small>{suffix}</small> : null}
        </div>
      ) : null}
      {!hasCheckout && options.length > 1 ? (
        <>
          <span id="licence-select-label" className="control-caption">
            {copy(locale, "Compare options", "Optionen vergleichen", "Seçenekleri karşılaştırın")}
          </span>
          <div className="purchase-select select-wrap">
            <select id="licence-select" aria-labelledby="licence-select-label" data-custom-select="" defaultValue={options[0].id}>
              {options.map((option) => (
                <option key={option.id} value={option.id} data-display={display(option)}>
                  {c(option.name)} · {display(option)} {billingSuffix(option)}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {hasCheckout && <ProductCheckoutForm prices={product.prices} locale={locale} termsVersion={product.checkout.termsVersion} ready={product.checkout.ready} testMode={product.checkout.mode === "test"} returnPath={href(`/products/${product.slug}`)} initialPriceId={initialPriceId} />}
      <p className="micro">{copy(locale,"Support scope does not restrict the code rights of the licence.","Der Supportumfang beschränkt keine Rechte aus der Code-Lizenz.","Destek kapsamı lisansın kod haklarını kısıtlamaz.")}</p>
      {product.compliance.codeLicense && <p className="micro">Code: {product.compliance.codeLicense} {product.compliance.noticesUrl&&<a href={product.compliance.noticesUrl}>{copy(locale,"License notices","Lizenzhinweise","Lisans bildirimleri")}</a>}</p>}
      {!hasCheckout && <Button href={/^\//.test(ctaUrl) ? href(ctaUrl) : ctaUrl}>{product.ctaLabel ? c(product.ctaLabel) : t("Ask about {name}", { name })}</Button>}
      {product.demoUrl ? (
        <Button href={/^\//.test(product.demoUrl) ? href(product.demoUrl) : product.demoUrl} kind="outline" up>
          {t("View visual demo")}
        </Button>
      ) : (
        <Button href={href(product.type.listPath)} kind="outline">
          {t("Back to {list}", { list: c(product.type.pluralName).toLocaleLowerCase(LOCALE_TAGS[locale]) })}
        </Button>
      )}
      {product.highlights.length > 0 ? (
        <div className="buy-includes">
          {product.highlights.map((line) => (
            <span key={line}>{c(line)}</span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export default function ProductDetail({ product, locale, initialPriceId }: { product: ProductPageData; locale: Locale; initialPriceId?: string }) {
  const t = getTranslator(locale);
  // Panel copy: translated where it matches catalog text, otherwise shown as written.
  const c = getTranslator(locale, { quiet: true });
  const href = (path: string) => localizePath(path, locale);
  const { name, slug } = product;
  const listPath = product.type.listPath;
  const month = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: "long", year: "numeric", timeZone: "UTC" });

  // Description HTML from the editor: catalog-matching text is translated, internal links keep the language.
  const catalog = locale === SOURCE_LOCALE ? null : loadAppCatalog(locale);
  const description = (catalog ? translateHtml(product.description, (key) => catalog.get(key)) : product.description).replace(
    /\bhref="(\/[^"]*)"/g,
    (_match, path: string) => `href="${href(path)}"`,
  );
  const hasDescription = description.replace(/<[^>]+>/g, "").trim().length > 0 || /<(img|video|iframe)\b/i.test(description);
  // Without a cover, the first gallery image takes the browser frame.
  const shot = product.cover ?? product.gallery[0] ?? null;
  const gallery = product.cover ? product.gallery : product.gallery.slice(1);

  const tabs: { key: string; label: string; body: ReactNode }[] = [];
  if (hasDescription) {
    tabs.push({ key: "description", label: t("Description"), body: <div className="product-richtext" dangerouslySetInnerHTML={{ __html: description }} /> });
  }
  if (product.compatibility.length > 0) {
    tabs.push({
      key: "compatibility",
      label: t("Compatibility"),
      body: (
        <>
          <PanelHead eyebrow={t("Compatibility")} title={t("Clear versions. Clear expectations.")} />
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>{t("Area")}</th>
                  <th>{t(product.status === "published" ? "Target" : "Planned target")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {product.compatibility.map((row, index) => (
                  <tr key={index}>
                    <td>{c(row.area)}</td>
                    <td>{c(row.target)}</td>
                    <td>{c(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ),
    });
  }
  tabs.push({ key: "reviews", label: t("Reviews"), body: <ReviewsPanel product={product} t={t} locale={locale} /> });
  if (product.changelog.length > 0) {
    tabs.push({
      key: "changelog",
      label: t("Changelog"),
      body: (
        <>
          <PanelHead eyebrow={t("Changelog")} title={t("Update history.")} text={product.status === "published" ? undefined : t(CHANGELOG_NOTE)} />
          <ol className="changelog">
            {product.changelog.map((entry) => (
              <li key={entry.id} className="changelog-entry">
                <div className="changelog-meta">
                  <span className="changelog-version">{entry.version}</span>
                  <time dateTime={entry.releasedAt.toISOString().slice(0, 7)}>{month.format(entry.releasedAt)}</time>
                </div>
                <div className="changelog-body">
                  <h3>{c(entry.title)}</h3>
                  <ul>
                    {entry.changes.map((change, index) => (
                      <li key={index}>
                        <span className={`changelog-tag is-${change.kind}`}>{t(CHANGE_LABELS[change.kind])}</span>
                        {c(change.text)}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  return (
    <SiteFrame locale={locale} path={`/products/${slug}`} current={listPath}>
      <section className="page-hero compact">
        <div className="container">
          <div className="crumbs">
            <a href={href("/")}>{t("Home")}</a>
            <span>/</span>
            <a href={href(listPath)}>{c(product.type.pluralName)}</a>
            <span>/</span>
            <span>{name}</span>
          </div>
          <span className="eyebrow">{product.tagline ? c(product.tagline) : product.category ? c(product.category) : c(product.type.name)}</span>
          <h1>
            {name}
            <em>.</em>
          </h1>
          <p>{c(product.intro ?? product.summary)}</p>
          <a className="product-rating" href="#reviews" data-review-badge hidden>
            <span className="review-stars" data-review-average-stars role="img" aria-label={t("Average rating")} />
            <strong data-review-average>–</strong>
            <span data-review-badge-count>{t("Reviews")}</span>
          </a>
        </div>
      </section>

      <section className="section-sm">
        <div className="container detail-layout">
          <div className="detail-main">
            {shot ? (
              <div className="browser detail-browser product-shot">
                <div className="browser-bar">
                  <i />
                  <i />
                  <i />
                  <span className="browser-url">{slug}.cmsmotive</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- media library URLs are arbitrary hosts */}
                <img src={shot.url} width={shot.width} height={shot.height} alt={c(shot.alt)} />
              </div>
            ) : null}
            {gallery.length > 0 ? (
              <div className="detail-gallery">
                {gallery.map((image, index) => (
                  // eslint-disable-next-line @next/next/no-img-element -- media library URLs are arbitrary hosts
                  <img key={`${image.url}-${index}`} src={image.url} width={image.width} height={image.height} alt={c(image.alt)} loading="lazy" />
                ))}
              </div>
            ) : null}

            <div className="product-tabs" data-product-tabs>
              <div className="product-tablist" role="tablist" aria-label={t("{name} details", { name })}>
                {tabs.map((tab, index) => (
                  <button
                    key={tab.key}
                    className="product-tab"
                    type="button"
                    role="tab"
                    id={`tab-${tab.key}`}
                    aria-controls={tab.key}
                    aria-selected={index === 0 ? "true" : "false"}
                  >
                    {tab.label}
                    {tab.key === "reviews" ? (
                      <>
                        {" "}
                        <span className="product-tab-count" data-review-count hidden />
                      </>
                    ) : null}
                  </button>
                ))}
              </div>
              {tabs.map((tab) => (
                <section key={tab.key} className="product-panel" role="tabpanel" id={tab.key} aria-labelledby={`tab-${tab.key}`}>
                  {tab.body}
                </section>
              ))}
            </div>
          </div>

          <BuyPanel product={product} t={t} c={c} href={href} locale={locale} initialPriceId={initialPriceId} />
        </div>
      </section>
      <Script src="/assets/js/product.js" strategy="afterInteractive" />
    </SiteFrame>
  );
}
