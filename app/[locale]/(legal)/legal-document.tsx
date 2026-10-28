import { sanitizeLegalContent } from "@/lib/legal-content";
import { getLegalSettings } from "@/lib/legal";
import { getLegalDocumentSettings } from "@/lib/legal-documents";
import { isBuiltinLegalSlug, legalDocuments, legalDocumentPath } from "@/lib/legal-documents-shared";
import { currentStoreId } from "@/lib/current-store";
import { legalReadiness } from "@/lib/legal-settings-shared";
import { copy, type LegalSlug } from "@/lib/legal-copy";
import { isLocale, localizePath } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { SiteFrame } from "../_components/site-chrome";

type Props = { params: Promise<{ locale: string; slug?: string }> };
export function legalPage(builtin?: LegalSlug) {
  async function resolve(params: Props["params"]) {
    const { locale, slug: custom } = await params;
    if (!isLocale(locale)) notFound();
    const slug = builtin ?? custom;
    if (!slug || (!builtin && isBuiltinLegalSlug(slug))) notFound();
    const storeId = await currentStoreId();
    const [settings, saved] = await Promise.all([getLegalSettings(storeId), getLegalDocumentSettings(storeId)]);
    const documents = legalDocuments(settings, saved, locale);
    const document = documents.find((d) => d.slug === slug && d.published);
    if (!document) notFound();
    return { locale, settings, documents, document, path: legalDocumentPath(slug) };
  }
  async function generateMetadata({ params }: Props) {
    const { locale, document, path } = await resolve(params);
    return pageMetadata({ locale, path, title: document.title + " — CMSMotive", description: document.title });
  }
  async function Page({ params }: Props) {
    const { locale: l, settings: s, documents, document, path } = await resolve(params);
    return (
      <SiteFrame locale={l} path={path}>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">CMSMotive / Legal</span>
            <h1>{document.title}</h1>
          </div>
        </section>
        <section className="section">
          <div className="container legal-content">
            {legalReadiness(s).length > 0 && (
              <p className="notice" role="status">
                {copy(l,
                  "Provider information is being completed. Product checkout is not available. For questions, contact the address below.",
                  "Die Anbieterangaben werden vervollständigt. Ein Produkt-Checkout ist nicht verfügbar. Fragen richten Sie an die unten genannte Adresse.",
                  "Sağlayıcı bilgileri tamamlanıyor. Ürün ödeme akışı açık değildir. Sorularınız için aşağıdaki iletişim adresini kullanın.",
                )}
              </p>
            )}
            <nav className="legal-nav" aria-label={copy(l, "Legal pages", "Rechtliche Seiten", "Hukuk sayfaları")}>
              {documents.filter((d) => d.published && (d.showInFooter || d.slug === document.slug)).map((d) => (
                <a key={d.slug} href={localizePath(legalDocumentPath(d.slug), l)} aria-current={d.slug === document.slug ? "page" : undefined}>
                  {d.title}
                </a>
              ))}
            </nav>
            {builtin && <p className="micro">
              {copy(l, "Document version", "Dokumentversion", "Belge sürümü")}: {builtin === "terms" ? s.termsVersion : s.privacyVersion}
            </p>}
            <article className="legal-richtext" dangerouslySetInnerHTML={{ __html: sanitizeLegalContent(document.content) }} />
          </div>
        </section>
      </SiteFrame>
    );
  }
  return { Page, generateMetadata };
}
