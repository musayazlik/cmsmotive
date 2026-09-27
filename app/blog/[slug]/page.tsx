import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trackPageView } from "@/lib/analytics";
import { SiteFrame } from "../_components/site-chrome";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function loadPost(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: "published" },
    include: {
      cover: { select: { url: true, fileName: true } },
      category: { select: { name: true } },
      author: { select: { name: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Article not found — CMSMotive" };
  return {
    title: `${post.title} — CMSMotive`,
    description: post.excerpt,
    robots: { index: true, follow: true },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  trackPageView(slug);

  const post = await loadPost(slug);
  if (!post) notFound();

  const others = await prisma.post.findMany({
    where: { status: "published", slug: { not: slug } },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: 2,
    select: {
      slug: true,
      title: true,
      readingTime: true,
      cover: { select: { url: true } },
      category: { select: { name: true } },
    },
  });

  const category = post.category?.name ?? "Journal";
  const published = (post.publishedAt ?? post.updatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SiteFrame current="/blog">
      <div className="container blog-detail-shell">
        <div className="crumbs">
          <a href="/">Home</a>
          <span>/</span>
          <a href="/blog">Journal</a>
          <span>/</span>
          <span>{category}</span>
        </div>
        <div className="blog-detail-grid">
          <div className="blog-detail-main">
            <article className="content-article">
              <header className="article-header">
                <span className="eyebrow">{category}</span>
                <h1>{post.title}</h1>
                <p className="intro">{post.excerpt}</p>
                <div className="article-meta">
                  {post.author?.name ?? "CMSMotive Editorial"} &nbsp; · &nbsp; {published} &nbsp; · &nbsp;{" "}
                  {post.readingTime} min read
                </div>
              </header>
              {post.cover ? (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts */}
                  <img src={post.cover.url} width={1536} height={1024} alt={`Cover image for article: ${post.title}`} />
                  <figcaption>{post.cover.fileName}</figcaption>
                </figure>
              ) : null}
              {/* Post bodies are authored in the admin tiptap editor — trusted HTML. */}
              <div className="article-copy" dangerouslySetInnerHTML={{ __html: post.content }} />
            </article>

            <section className="comments-section" data-comments data-article={post.slug} aria-labelledby="comments-title">
              <div className="comments-heading">
                <div>
                  <span className="eyebrow">The conversation</span>
                  <h2 id="comments-title">
                    Comments <span data-comment-count>0</span>
                  </h2>
                </div>
                <p>Share a thought or continue a thread.</p>
              </div>
              <div className="comment-list" data-comment-list>
                <p className="comment-empty">Loading comments…</p>
              </div>
              <div className="comment-composer">
                <h3>Leave a comment</h3>
                <p>Comments in this preview are saved only in this browser.</p>
                <form className="comment-form" data-comment-form>
                  <div className="comment-field">
                    <label htmlFor="comment-name">Your name</label>
                    <input
                      id="comment-name"
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={60}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="comment-field">
                    <label htmlFor="comment-message">Your comment</label>
                    <textarea
                      id="comment-message"
                      name="message"
                      rows={5}
                      required
                      minLength={2}
                      maxLength={2000}
                      placeholder="Add to the conversation..."
                    />
                  </div>
                  <div className="comment-form-bottom">
                    <span>Be thoughtful and constructive.</span>
                    <button className="btn btn-primary" type="submit">
                      <span className="btn-label">Post comment</span>
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

          <aside className="blog-detail-aside" aria-label="Popular articles">
            <div className="popular-panel">
              <span className="eyebrow">From the journal</span>
              <h2>More articles</h2>
              <div className="popular-list">
                {others.length === 0 ? (
                  <p className="comment-empty">More stories are in the works.</p>
                ) : (
                  others.map((other) => (
                    <a className="popular-item" href={`/blog/${other.slug}`} key={other.slug}>
                      {other.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                        <img src={other.cover.url} width={96} height={72} loading="lazy" alt="" />
                      ) : null}
                      <span>
                        <small>
                          {(other.category?.name ?? "Journal")} · {other.readingTime} min read
                        </small>
                        <strong>{other.title}</strong>
                        <span className="popular-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </span>
                    </a>
                  ))
                )}
              </div>
              <a className="popular-all" href="/blog">
                Explore the journal <span aria-hidden="true">↗</span>
              </a>
            </div>
          </aside>
        </div>
        <div className="blog-detail-back">
          <a className="btn btn-outline" href="/blog">
            <span className="btn-label">Back to journal</span>
            <span className="btn-icon" aria-hidden="true">
              <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
            </span>
          </a>
        </div>
      </div>
    </SiteFrame>
  );
}
