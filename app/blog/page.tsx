import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { trackPageView } from "@/lib/analytics";
import { SiteFrame } from "./_components/site-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal — CMSMotive",
  description: "Read CMSMotive articles on TYPO3, accessibility and design systems.",
  robots: { index: true, follow: true },
};

/** "SEPTEMBER 2026" style card footer dates. */
function monthYear(iso: string | null) {
  return (iso ? new Date(iso) : new Date())
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();
}

export default async function BlogPage() {
  trackPageView("blog");

  const posts = await prisma.post.findMany({
    where: { status: "published" },
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

  return (
    <SiteFrame current="/blog">
      <section className="journal-hero" aria-labelledby="journal-title">
        <div className="container">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>/</span>
            <span>Journal</span>
          </div>
          <div className="journal-hero-meta">
            <span>
              <i aria-hidden="true"></i> THE CMSMOTIVE JOURNAL
            </span>
            <span>FIELD NOTES &nbsp; / &nbsp; 2026</span>
          </div>
          <div className="journal-hero-grid">
            <div>
              <span className="eyebrow">Ideas / practice / process</span>
              <h1 id="journal-title">
                Notes from
                <br />
                the <em>build.</em>
              </h1>
            </div>
            <div className="journal-hero-aside">
              <span className="journal-aside-index">01 / THE EDITION</span>
              <p>
                Clear thinking for teams building with TYPO3. Read about the design decisions, accessibility details and
                developer workflows behind work that lasts.
              </p>
              <div className="journal-topics">
                <span>Design systems</span>
                <span>Accessibility</span>
                <span>Developer workflow</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="journal-stories" aria-label="Journal articles">
        <div className="container">
          {posts.length === 0 ? (
            <div className="journal-latest-heading">
              <div>
                <span className="eyebrow">The collection</span>
                <h2>New stories are on the way.</h2>
              </div>
              <p>The first articles are still being written in the workspace. Check back shortly.</p>
            </div>
          ) : (
            <>
              {featured ? (
                <div className="journal-section-line">
                  <span>FEATURED STORY</span>
                  <span>01 &nbsp; / &nbsp; {String(posts.length).padStart(2, "0")}</span>
                </div>
              ) : null}

              {featured ? (
                <article className="journal-feature" data-reveal>
                  <a href={`/blog/${featured.slug}`} className="journal-feature-link" aria-label={`Read ${featured.title}`}>
                    <div className="journal-feature-copy">
                      <div className="journal-story-meta">
                        <span>{(featured.category?.name ?? "JOURNAL").toUpperCase()}</span>
                        <span>{featured.readingTime} MIN READ</span>
                      </div>
                      <div>
                        <span className="journal-feature-number">01 / EDITOR&rsquo;S PICK</span>
                        <h2>{featured.title}</h2>
                        <p>{featured.excerpt}</p>
                        <span className="journal-read-link">
                          Read the story <span aria-hidden="true">↗</span>
                        </span>
                      </div>
                      <span className="journal-feature-bottom">
                        CMSMOTIVE EDITORIAL &nbsp; · &nbsp; {monthYear(featured.publishedAt?.toISOString() ?? null)}
                      </span>
                    </div>
                    <div className="journal-feature-image">
                      {featured.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                        <img src={featured.cover.url} width={1536} height={1024} alt="" fetchPriority="high" />
                      ) : null}
                      <span>
                        {featured.category?.name?.toUpperCase() ?? "JOURNAL"} &nbsp; / &nbsp; 01
                      </span>
                    </div>
                  </a>
                </article>
              ) : null}

              {rest.length > 0 ? (
                <>
                  <div className="journal-latest-heading" id="latest">
                    <div>
                      <span className="eyebrow">The collection</span>
                      <h2>More from the journal.</h2>
                    </div>
                    <p>Practical notes from the places where design, content and engineering meet.</p>
                  </div>
                  <div className="journal-card-grid">
                    {rest.map((post, index) => (
                      <article className="journal-card" data-reveal={index % 2 === 1 ? "delay" : undefined} key={post.slug}>
                        <a href={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
                          <div className="journal-card-image">
                            {post.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element -- covers live on arbitrary UploadThing hosts
                              <img src={post.cover.url} width={1536} height={1024} loading="lazy" alt="" />
                            ) : null}
                            <span>
                              {String(index + 2).padStart(2, "0")} / {(post.category?.name ?? "JOURNAL").toUpperCase()}
                            </span>
                          </div>
                          <div className="journal-card-copy">
                            <div className="journal-story-meta">
                              <span>{(post.category?.name ?? "JOURNAL").toUpperCase()}</span>
                              <span>{post.readingTime} MIN READ</span>
                            </div>
                            <h3>{post.title}</h3>
                            <p>{post.excerpt}</p>
                            <span className="journal-card-foot">
                              <span>{monthYear(post.publishedAt?.toISOString() ?? null)}</span>
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
                  <span className="eyebrow">Beyond the articles</span>
                  <h2>Take the thinking into your next build.</h2>
                  <p>Explore the product directions and documentation behind these ideas.</p>
                </div>
                <div className="journal-outro-actions">
                  <a className="btn btn-lime" href="/themes">
                    <span className="btn-label">Explore themes</span>
                    <span className="btn-icon" aria-hidden="true">
                      <img src="/assets/icons/arrow-right.svg" alt="" width={16} height={16} />
                    </span>
                  </a>
                  <a className="text-link" href="/docs">
                    Browse the docs<span aria-hidden="true"> ↗</span>
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
