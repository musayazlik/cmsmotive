import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { LatestPostsProps } from "./schema";

const SAMPLE_POSTS = [
  {
    id: "sample-p-1",
    slug: "typo3-v13-release-notes",
    title: "Getting started with TYPO3 v13 and modern frontend architectures",
    excerpt: "An overview of what has changed, performance benchmarks and best practices for site integrators.",
    readingTime: 5,
    category: "Guides",
    coverUrl: null,
  },
  {
    id: "sample-p-2",
    slug: "optimizing-headless-cms",
    title: "Optimizing Core Web Vitals with Headless TYPO3 and Next.js",
    excerpt: "How to achieve 100 on PageSpeed Insights while keeping the editorial experience flexible.",
    readingTime: 4,
    category: "Performance",
    coverUrl: null,
  },
  {
    id: "sample-p-3",
    slug: "enterprise-security-checklist",
    title: "Enterprise CMS Security Checklist for 2026",
    excerpt: "Crucial hardening tips, headers and access policies for corporate content repositories.",
    readingTime: 6,
    category: "Security",
    coverUrl: null,
  },
];

export const LatestPostsRender: PuckComponent<LatestPostsProps> = ({
  columns = 3,
  id,
  lang,
  ariaLabel,
  _resolvedPosts,
}) => {
  const posts = _resolvedPosts && _resolvedPosts.length > 0 ? _resolvedPosts : SAMPLE_POSTS;

  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "50px auto" }}>
      <div
        className="article-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 16,
        }}
      >
        {posts.map((post) => (
          <article key={post.id} className="article-card">
            {post.category && <span className="micro">{post.category}</span>}
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <a href={`/blog/${post.slug}`} className="text-link">
              Read article ({post.readingTime} min) →
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};
