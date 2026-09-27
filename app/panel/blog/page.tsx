import { prisma } from "@/lib/prisma";
import BlogList from "./_components/blog-list";
import type { PostRow } from "./_lib";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  // Promote scheduled posts whose time has come; no cron needed at panel load.
  await prisma.post.updateMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });

  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { id: true, name: true, color: true } },
      cover: { select: { id: true, url: true, fileName: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });

  const rows: PostRow[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    status: post.status as PostRow["status"],
    featured: post.featured,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    readingTime: post.readingTime,
    cover: post.cover ? { assetId: post.cover.id, url: post.cover.url, name: post.cover.fileName } : null,
    categoryId: post.category?.id ?? null,
    categoryName: post.category?.name ?? null,
    categoryColor: post.category?.color ?? null,
    tags: post.tags.map(({ tag }) => ({ id: tag.id, name: tag.name })),
    updatedAt: post.updatedAt.toISOString(),
  }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / BLOG
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Posts in the <em>blog.</em>
          </h1>
          <p>
            Every post in the database with its cover, category, tags and publish state. Write with the rich
            editor, tune the SEO fields and publish — or schedule the post to go live on its own.
          </p>
        </div>
        <span className="workspace-index">BLOG</span>
      </div>

      <BlogList posts={rows} />
    </>
  );
}
