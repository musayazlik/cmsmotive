import loadingHtml from "@/static-site/loading.html";
import { parseLegacyDocument } from "@/lib/legacy-document";
import { loadCatalog } from "@/lib/i18n/catalog";
import { SOURCE_LOCALE } from "@/lib/i18n/config";
import { translateHtml } from "@/lib/i18n/html";
import { getRequestLocale } from "@/lib/i18n/request";
import { SiteFrame } from "../_components/site-chrome";

const doc = parseLegacyDocument(loadingHtml, "loading.html");

/**
 * Shown while the journal index reads posts from the database: the loader
 * from static-site/loading.html inside the same frame the journal renders
 * with, so nothing jumps when the page arrives. Scoped to the (journal)
 * group on purpose: a loading boundary above /blog/[slug] would start
 * streaming before notFound() runs and turn missing articles into 200s.
 * Loading boundaries get no params, so the language comes from proxy.ts.
 */
export default async function JournalLoading() {
  const locale = await getRequestLocale();
  const catalog = locale === SOURCE_LOCALE ? null : loadCatalog(locale);
  const main = catalog ? translateHtml(doc.main, (key) => catalog.get(key)) : doc.main;
  return (
    <SiteFrame locale={locale} path="/blog" current="/blog">
      {doc.stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: main }} />
    </SiteFrame>
  );
}
