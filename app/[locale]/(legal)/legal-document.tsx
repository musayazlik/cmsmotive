import { getLegalSettings } from "@/lib/legal";
import { legalReadiness } from "@/lib/legal-settings-shared";
import {
  copy,
  legalSections,
  legalTitle,
  type LegalSlug,
} from "@/lib/legal-copy";
import { isLocale, localizePath } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { SiteFrame } from "../_components/site-chrome";
type Props = { params: Promise<{ locale: string }> };
export function legalPage(slug: LegalSlug) {
  async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    const title = legalTitle(slug, locale);
    return pageMetadata({
      locale,
      path: `/${slug}`,
      title: `${title} — CMSMotive`,
      description: title,
    });
  }
  async function Page({ params }: Props) {
    const { locale: l } = await params;
    if (!isLocale(l)) notFound();
    const s = await getLegalSettings();
    const title = legalTitle(slug, l);
    const incomplete = legalReadiness(s).length > 0;
    return (
      <SiteFrame locale={l} path={`/${slug}`}>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">CMSMotive / Legal</span>
            <h1>{title}</h1>
          </div>
        </section>
        <section className="section">
          <div className="container legal-content">
            {incomplete && (
              <p className="notice" role="status">
                {copy(
                  l,
                  "Provider information is being completed. Product checkout is not available. For questions, contact the address below.",
                  "Die Anbieterangaben werden vervollständigt. Ein Produkt-Checkout ist nicht verfügbar. Fragen richten Sie an die unten genannte Adresse.",
                  "Sağlayıcı bilgileri tamamlanıyor. Ürün ödeme akışı açık değildir. Sorularınız için aşağıdaki iletişim adresini kullanın.",
                )}
              </p>
            )}
            <nav
              className="legal-nav"
              aria-label={copy(
                l,
                "Legal pages",
                "Rechtliche Seiten",
                "Hukuk sayfaları",
              )}
            >
              {(["imprint", "privacy", "terms", "cookies"] as const).map(
                (key) => (
                  <a
                    key={key}
                    href={localizePath(`/${key}`, l)}
                    aria-current={key === slug ? "page" : undefined}
                  >
                    {legalTitle(key, l)}
                  </a>
                ),
              )}
            </nav>
            <p className="micro">
              {copy(l, "Document version", "Dokumentversion", "Belge sürümü")}:{" "}
              {slug === "terms" ? s.termsVersion : s.privacyVersion}
            </p>
            {legalSections(slug, l, s).map((section, i) => (
              <section className="legal-section" key={i}>
                <h2>{section.title}</h2>
                {section.paragraphs.filter(Boolean).map((text, j) => (
                  <p className="legal-paragraph" key={j}>
                    {text}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </section>
      </SiteFrame>
    );
  }
  return { Page, generateMetadata };
}
