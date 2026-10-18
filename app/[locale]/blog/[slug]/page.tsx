import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trackPageView } from "@/lib/analytics";
import { LOCALE_TAGS, localizePath, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translate";
import { absoluteUrl, breadcrumbSchema, organizationRef, pageMetadata, siteOrigin } from "@/lib/seo";
import { isValidPostPreview } from "@/lib/post-preview";
import { getSiteSettings } from "@/lib/settings";
import { SiteFrame } from "../../_components/site-chrome";
import { JsonLd } from "../../_components/json-ld";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ preview?: string; exp?: string }>;
};

/**
 * The published post, or an unpublished one opened with a signed preview
 * link (lib/post-preview.ts) — then `preview` is true.
 */
async function loadPost(slug: string, search: { preview?: string; exp?: string }) {
  const post = await prisma.post.findFirst({
    where: { slug },
    include: {
      cover: { select: { url: true, fileName: true, width: true, height: true } },
      category: { select: { name: true } },
      author: { select: { name: true } },
    },
  });
  if (!post) return null;
  if (post.status === "published") return { ...post, preview: false };
  return isValidPostPreview(post.id, search.preview, search.exp) ? { ...post, preview: true } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = getTranslator(locale as Locale);
  const post = await loadPost(slug, await searchParams);
  if (!post) return { title: t("Article not found — CMSMotive") };
  if (post.preview) return { title: `Draft: ${post.title}`, robots: { index: false, follow: false } };
  const cover = post.cover;
  return pageMetadata({
    locale: locale as Locale,
    path: `/blog/${post.slug}`,
    title: `${post.title} — CMSMotive`,
    description: post.excerpt,
    image: cover ? { url: cover.url, width: cover.width ?? undefined, height: cover.height ?? undefined } : null,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: post.author?.name ? [post.author.name] : undefined,
  });
}

/** Post bodies are stored once, in the language they were written in; the page around them follows the URL. */
export default async function BlogPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  const t = getTranslator(locale);
  const href = (path: string) => localizePath(path, locale);
  const post = await loadPost(slug, await searchParams);
  if (!post) notFound();
  if (!post.preview) trackPageView(slug);

  const [candidates, recent, categories, viewRows] = await Promise.all([
    // Ranking pool for "Popular content": the journal's own order (featured first, then newest).
    prisma.post.findMany({
      where: { status: "published", slug: { not: slug } },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 12,
      select: {
        slug: true,
        title: true,
        readingTime: true,
        cover: { select: { url: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.post.findMany({
      where: { status: "published", slug: { not: slug } },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 4,
      select: { slug: true, title: true, publishedAt: true, createdAt: true, category: { select: { name: true } } },
    }),
    prisma.category.findMany({
      where: { posts: { some: { status: "published" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { posts: { where: { status: "published" } } } } },
    }),
    // Per-slug view totals rank the popular list; static-site slugs fall away with the post match.
    prisma.pageViewDaily.groupBy({ by: ["slug"], _sum: { views: true } }),
  ]);

  const views = new Map(viewRows.map((row) => [row.slug, row._sum.views ?? 0]));
  // Stable sort keeps the journal order (featured first) on equal views.
  const popular = [...candidates].sort((a, b) => (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0)).slice(0, 3);
  const shortDate = (value: Date) =>
    value.toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric" });

  const category = post.category?.name ?? t("Journal");
  const [origin, site] = await Promise.all([siteOrigin(), getSiteSettings()]);
  const url = absoluteUrl(origin, href(`/blog/${post.slug}`));
  const jsonLd = [
    {
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url,
      mainEntityOfPage: url,
      ...(post.cover ? { image: [absoluteUrl(origin, post.cover.url)] } : {}),
      datePublished: (post.publishedAt ?? post.updatedAt).toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: post.author?.name ? { "@type": "Person", name: post.author.name } : organizationRef(origin, site),
      publisher: organizationRef(origin, site),
      ...(post.category ? { articleSection: post.category.name } : {}),
    },
    breadcrumbSchema(origin, [
      { name: t("Home"), url: href("/") },
      { name: t("Journal"), url: href("/blog") },
      { name: post.title, url },
    ]),
  ].filter((entry) => entry !== null);
  const published = (post.publishedAt ?? post.updatedAt).toLocaleDateString(LOCALE_TAGS[locale], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SiteFrame locale={locale} path={`/blog/${post.slug}`} current="/blog">
      {post.preview ? null : <JsonLd data={jsonLd} />}
      <section className="blog-hero" aria-labelledby="post-title">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
          <img className="blog-hero-bg" src={post.cover.url} alt="" fetchPriority="high" />
        ) : null}
        <div className="container blog-hero-inner">
          <div className="crumbs">
            <a href={href("/")}>{t("Home")}</a>
            <span>/</span>
            <a href={href("/blog")}>{t("Journal")}</a>
            <span>/</span>
            <span>{category}</span>
          </div>
          <div className="blog-hero-copy">
            <span className="eyebrow light">{category}</span>
            <h1 id="post-title">{post.title}</h1>
            <p className="blog-hero-intro">{post.excerpt}</p>
            <div className="blog-hero-meta">
              <span>{post.author?.name ?? t("CMSMotive Editorial")}</span>
              <span>{published}</span>
              <span>{t("{n} min read", { n: post.readingTime })}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container blog-detail-shell">
        <div className="blog-detail-grid">
          <div className="blog-detail-main">
            {post.preview ? (
              <p
                role="status"
                style={{ margin: "0 0 24px", padding: "12px 16px", borderRadius: 10, background: "#fff2df", border: "1px solid #f7d8aa", color: "#7a4300", fontWeight: 600 }}
              >
                Draft preview — this post is not published. The link expires after seven days.
              </p>
            ) : null}
            <article className="content-article">
              {/* The title, excerpt and cover live in the hero above; the body stays authored HTML. */}
              <div className="article-copy" dangerouslySetInnerHTML={{ __html: post.content }} />
            </article>

            <section className="comments-section" data-comments data-article={post.slug} aria-labelledby="comments-title">
              <div className="comments-heading">
                <div>
                  <span className="eyebrow">{t("The conversation")}</span>
                  <h2 id="comments-title">
                    {t("Comments")} <span data-comment-count>0</span>
                  </h2>
                </div>
                <p>{t("Share a thought or continue a thread.")}</p>
              </div>
              <div className="comment-list" data-comment-list>
                <p className="comment-empty">{t("Loading comments…")}</p>
              </div>
              <div className="comment-composer">
                <h3>{t("Leave a comment")}</h3>
                <p>{t("Comments in this preview are saved only in this browser.")}</p>
                <form className="comment-form" data-comment-form>
                  <div className="comment-field">
                    <label htmlFor="comment-name">{t("Your name")}</label>
                    <input
                      id="comment-name"
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={60}
                      placeholder={t("Your name")}
                    />
                  </div>
                  <div className="comment-field">
                    <label htmlFor="comment-message">{t("Your comment")}</label>
                    <textarea
                      id="comment-message"
                      name="message"
                      rows={5}
                      required
                      minLength={2}
                      maxLength={2000}
                      placeholder={t("Add to the conversation...")}
                    />
                  </div>
                  <div className="comment-form-bottom">
                    <span>{t("Be thoughtful and constructive.")}</span>
                    <button className="btn btn-primary" type="submit">
                      <span className="btn-label">{t("Post comment")}</span>
                      <span className="btn-icon" aria-hidden="true">
                        <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
                      </span>
                    </button>
                  </div>
                  <p className="comment-status" role="status" aria-live="polite" data-comment-status></p>
                </form>
              </div>
            </section>
          </div>

          <aside className="blog-detail-aside" aria-label={t("From the journal")}>
            <div className="blog-widget">
              <span className="eyebrow">{t("From the journal")}</span>
              <h2>{t("Popular content")}</h2>
              {popular.length === 0 ? (
                <p className="blog-widget-empty">{t("More stories are in the works.")}</p>
              ) : (
                <div className="popular-list">
                  {popular.map((item) => (
                    <a
                      className={item.cover ? "popular-item" : "popular-item no-cover"}
                      href={href(`/blog/${item.slug}`)}
                      key={item.slug}
                    >
                      {item.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                        <img src={item.cover.url} width={96} height={72} loading="lazy" alt="" />
                      ) : null}
                      <span>
                        <small>
                          {item.category?.name ?? t("Journal")} · {t("{n} min read", { n: item.readingTime })}
                        </small>
                        <strong>{item.title}</strong>
                        <span className="popular-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
              <a className="popular-all" href={href("/blog")}>
                {t("Explore the journal")} <span aria-hidden="true">↗</span>
              </a>
            </div>

            {categories.length > 0 ? (
              <div className="blog-widget">
                <span className="eyebrow">{t("Browse")}</span>
                <h2>{t("Categories")}</h2>
                <div className="blog-widget-list">
                  {categories.map((entry) => (
                    <div className="category-row" key={entry.id}>
                      <span className="category-dot" style={{ background: entry.color }} aria-hidden="true" />
                      <strong>{entry.name}</strong>
                      <span className="category-count">{entry._count.posts}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {recent.length > 0 ? (
              <div className="blog-widget">
                <span className="eyebrow">{t("Latest")}</span>
                <h2>{t("Recent posts")}</h2>
                <div className="blog-widget-list">
                  {recent.map((item) => (
                    <a className="recent-row" href={href(`/blog/${item.slug}`)} key={item.slug}>
                      <time dateTime={(item.publishedAt ?? item.createdAt).toISOString()}>
                        {shortDate(item.publishedAt ?? item.createdAt)}
                      </time>
                      <strong>{item.title}</strong>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
        <div className="blog-detail-back">
          <a className="btn btn-outline" href={href("/blog")}>
            <span className="btn-label">{t("Back to journal")}</span>
            <span className="btn-icon" aria-hidden="true">
              <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
            </span>
          </a>
        </div>
      </div>
    </SiteFrame>
  );
}
