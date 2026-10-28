import { isLocale, localizePath, type Locale } from "./i18n/config";
import { legalSections, legalTitle, type LegalSlug } from "./legal-copy";
import type { LegalSettings } from "./legal-settings-shared";

export const BUILTIN_LEGAL_SLUGS = ["imprint", "privacy", "terms", "cookies"] as const;
export type LegalDocument = {
  slug: string;
  locale: Locale;
  title: string;
  content: string;
  published: boolean;
  showInFooter: boolean;
};
export const DEFAULT_LEGAL_DOCUMENTS = { documents: [] as LegalDocument[] };
export type LegalDocumentSettings = typeof DEFAULT_LEGAL_DOCUMENTS;
export const isBuiltinLegalSlug = (slug: string): slug is LegalSlug =>
  (BUILTIN_LEGAL_SLUGS as readonly string[]).includes(slug);
export const legalDocumentPath = (slug: string) => isBuiltinLegalSlug(slug) ? `/${slug}` : `/legal/${slug}`;
export const escapeLegalHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function legalDocuments(settings: LegalSettings, saved: LegalDocumentSettings, locale: Locale): LegalDocument[] {
  return [
    ...BUILTIN_LEGAL_SLUGS.map((slug) => saved.documents.find((d) => d.slug === slug && d.locale === locale) ?? {
      slug, locale, title: legalTitle(slug, locale), published: true, showInFooter: true,
      content: legalSections(slug, locale, settings).map((section) =>
        `<h2>${escapeLegalHtml(section.title)}</h2>${section.paragraphs.filter(Boolean).map((p) => `<p>${escapeLegalHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}`,
      ).join(""),
    }),
    ...saved.documents.filter((d) => d.locale === locale && !isBuiltinLegalSlug(d.slug)),
  ];
}

export function legalFooterLinks(saved: LegalDocumentSettings, locale: Locale) {
  return [
    ...BUILTIN_LEGAL_SLUGS.map((slug) => saved.documents.find((d) => d.slug === slug && d.locale === locale) ??
      { slug, title: legalTitle(slug, locale), published: true, showInFooter: true }),
    ...saved.documents.filter((d) => d.locale === locale && !isBuiltinLegalSlug(d.slug)),
  ].filter((d) => d.published && d.showInFooter).map((d) => ({
    title: d.title, href: localizePath(legalDocumentPath(d.slug), locale),
  }));
}

/** Footer injection runs after the legacy page's URL and text localization. */
export function injectLegalFooter(html: string, saved: LegalDocumentSettings, locale: Locale) {
  const links = legalFooterLinks(saved, locale).map(({ href, title }) =>
    `<a href="${escapeLegalHtml(href)}">${escapeLegalHtml(title)}</a>`,
  ).join("");
  return html.replace(/(<div class="footer-col">\s*<div class="footer-label">[^<]*<\/div>)([\s\S]*?)(<\/div>)/g,
    (match, heading: string, body: string, close: string) =>
      /href="(?:\/(?:en|tr))?\/imprint"/.test(body) ? heading + links + close : match,
  );
}

export function validateLegalDocuments(input: Record<string, unknown>): { data: LegalDocumentSettings } | { error: string } {
  if (!Array.isArray(input.documents) || input.documents.length > 60) return { error: "Use at most 60 legal pages." };
  const documents: LegalDocument[] = [];
  const keys = new Set<string>();
  let total = 0;
  for (const value of input.documents) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid legal page." };
    const d = value as Record<string, unknown>;
    if (typeof d.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug) || d.slug.length > 80)
      return { error: "Use a page address with lowercase letters, numbers and hyphens (up to 80 characters)." };
    if (typeof d.locale !== "string" || !isLocale(d.locale)) return { error: "Choose a page language." };
    if (typeof d.title !== "string" || !d.title.trim() || d.title.length > 160) return { error: "Enter a page title (up to 160 characters)." };
    if (typeof d.content !== "string" || d.content.length > 100_000) return { error: "Page content must be under 100,000 characters." };
    total += d.content.length;
    if (total > 500_000) return { error: "Total legal content must be under 500,000 characters." };
    if (typeof d.published !== "boolean" || typeof d.showInFooter !== "boolean") return { error: "Invalid publication settings." };
    if (isBuiltinLegalSlug(d.slug) && !d.published) return { error: "Required legal pages must remain published." };
    if (d.published && !d.content.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/g, " ").trim())
      return { error: "Add content before publishing this page." };
    const key = `${d.locale}/${d.slug}`;
    if (keys.has(key)) return { error: "A page with this address already exists in this language." };
    keys.add(key);
    documents.push({ slug: d.slug, locale: d.locale, title: d.title.trim(), content: d.content, published: d.published, showInFooter: d.showInFooter });
  }
  return { data: { documents } };
}
