import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { trackPageView } from "@/lib/analytics";
import { LOCALE_TAGS, localizePath, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translate";
import { absoluteUrl, breadcrumbSchema, pageMetadata, siteOrigin } from "@/lib/seo";
import { SiteFrame } from "../../_components/site-chrome";
import { JsonLd } from "../../_components/json-ld";
import { currentStoreId } from "@/lib/current-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = getTranslator(locale);
  return pageMetadata({
    locale,
    path: "/blog",
    title: t("Journal — CMSMotive"),
    description: t("Read CMSMotive articles on TYPO3, accessibility and design systems."),
  });
}

export default async function BlogPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const t = getTranslator(locale);
  const href = (path: string) => localizePath(path, locale);
  const storeId = await currentStoreId();
  trackPageView(storeId, "blog");

  /** "SEPTEMBER 2026" style card footer dates, in the page language. */
  const monthYear = (date: Date | null) =>
    (date ?? new Date()).toLocaleDateString(LOCALE_TAGS[locale], { month: "long", year: "numeric" }).toLocaleUpperCase(LOCALE_TAGS[locale]);
  const categoryLabel = (name: string | undefined) => (name ?? t("JOURNAL")).toLocaleUpperCase(LOCALE_TAGS[locale]);

  const posts = await prisma.post.findMany({
    where: { storeId, status: "published" },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: 13,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      readingTime: true,
      featured: true,
      publishedAt: true,
      cover: { select: { url: true } },
      category: { select: { name: true } },
    },
  });

  const [featured, ...rest] = posts;
  const origin = await siteOrigin();
  const breadcrumbs = breadcrumbSchema(origin, [
    { name: t("Home"), url: href("/") },
    { name: t("Journal"), url: absoluteUrl(origin, href("/blog")) },
  ]);

  return (
    <SiteFrame locale={locale} path="/blog" current="/blog">
      {breadcrumbs ? <JsonLd data={breadcrumbs} /> : null}
      <section className="journal-hero" aria-labelledby="journal-title">
        <div className="container">
          <div className="crumbs">
            <a href={href("/")}>{t("Home")}</a>
            <span>/</span>
            <span>{t("Journal")}</span>
          </div>
          <div className="journal-hero-meta">
            <span>
              <i aria-hidden="true"></i> {t("THE CMSMOTIVE JOURNAL")}
            </span>
            <span>{t("FIELD NOTES")} &nbsp; / &nbsp; 2026</span>
          </div>
          <div className="journal-hero-grid">
            <div>
              <span className="eyebrow">{t("Ideas / practice / process")}</span>
              <h1 id="journal-title">
                {t("Notes from")}
                <br />
                {t("the")} <em>{t("build.")}</em>
              </h1>
            </div>
            <div className="journal-hero-aside">
              <span className="journal-aside-index">{t("01 / THE EDITION")}</span>
              <p>
                {t(
                  "Clear thinking for teams building with TYPO3. Read about the design decisions, accessibility details and developer workflows behind work that lasts.",
                )}
              </p>
              <div className="journal-topics">
                <span>{t("Design systems")}</span>
                <span>{t("Accessibility")}</span>
                <span>{t("Developer workflow")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="journal-stories" aria-label={t("Journal articles")}>
        <div className="container">
          {posts.length === 0 ? (
            <div className="journal-latest-heading">
              <div>
                <span className="eyebrow">{t("The collection")}</span>
                <h2>{t("New stories are on the way.")}</h2>
              </div>
              <p>{t("The first articles are still being written in the workspace. Check back shortly.")}</p>
            </div>
          ) : (
            <>
              {featured ? (
                <div className="journal-section-line">
                  <span>{t("FEATURED STORY")}</span>
                  <span>01 &nbsp; / &nbsp; {String(posts.length).padStart(2, "0")}</span>
                </div>
              ) : null}

              {featured ? (
                <article className="journal-feature" data-reveal>
                  <a href={href(`/blog/${featured.slug}`)} className="journal-feature-link" aria-label={t("Read {title}", { title: featured.title })}>
                    <div className="journal-feature-copy">
                      <div className="journal-story-meta">
                        <span>{categoryLabel(featured.category?.name)}</span>
                        <span>{t("{n} MIN READ", { n: featured.readingTime })}</span>
                      </div>
                      <div>
                        <span className="journal-feature-number">{t("01 / EDITOR'S PICK")}</span>
                        <h2>{featured.title}</h2>
                        <p>{featured.excerpt}</p>
                        <span className="journal-read-link">
                          {t("Read the story")} <span aria-hidden="true">↗</span>
                        </span>
                      </div>
                      <span className="journal-feature-bottom">
                        {t("CMSMOTIVE EDITORIAL")} &nbsp; · &nbsp; {monthYear(featured.publishedAt)}
                      </span>
                    </div>
                    <div className="journal-feature-image">
                      {featured.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                        <img src={featured.cover.url} width={1536} height={1024} alt="" fetchPriority="high" />
                      ) : null}
                      <span>
                        {categoryLabel(featured.category?.name)} &nbsp; / &nbsp; 01
                      </span>
                    </div>
                  </a>
                </article>
              ) : null}

              {rest.length > 0 ? (
                <>
                  <div className="journal-latest-heading" id="latest">
                    <div>
                      <span className="eyebrow">{t("The collection")}</span>
                      <h2>{t("More from the journal.")}</h2>
                    </div>
                    <p>{t("Practical notes from the places where design, content and engineering meet.")}</p>
                  </div>
                  <div className="journal-card-grid">
                    {rest.map((post, index) => (
                      <article className="journal-card" data-reveal={index % 2 === 1 ? "delay" : undefined} key={post.slug}>
                        <a href={href(`/blog/${post.slug}`)} aria-label={t("Read {title}", { title: post.title })}>
                          <div className="journal-card-image">
                            {post.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                              <img src={post.cover.url} width={1536} height={1024} loading="lazy" alt="" />
                            ) : null}
                            <span>
                              {String(index + 2).padStart(2, "0")} / {categoryLabel(post.category?.name)}
                            </span>
                          </div>
                          <div className="journal-card-copy">
                            <div className="journal-story-meta">
                              <span>{categoryLabel(post.category?.name)}</span>
                              <span>{t("{n} MIN READ", { n: post.readingTime })}</span>
                            </div>
                            <h3>{post.title}</h3>
                            <p>{post.excerpt}</p>
                            <span className="journal-card-foot">
                              <span>{monthYear(post.publishedAt)}</span>
                              <span aria-hidden="true">↗</span>
                            </span>
                          </div>
                        </a>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="journal-outro" data-reveal>
                <div>
                  <span className="eyebrow">{t("Beyond the articles")}</span>
                  <h2>{t("Take the thinking into your next build.")}</h2>
                  <p>{t("Explore the product directions and documentation behind these ideas.")}</p>
                </div>
                <div className="journal-outro-actions">
                  <a className="btn btn-lime" href={href("/themes")}>
                    <span className="btn-label">{t("Explore themes")}</span>
                    <span className="btn-icon" aria-hidden="true">
                      <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
                    </span>
                  </a>
                  <a className="text-link" href={href("/docs")}>
                    {t("Browse the docs")}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
