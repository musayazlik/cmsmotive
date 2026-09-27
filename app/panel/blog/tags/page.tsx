import { prisma } from "@/lib/prisma";
import TagManager from "../_components/tag-manager";

export const dynamic = "force-dynamic";

export default async function BlogTagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / BLOG / TAGS
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Blog <em>tags.</em>
          </h1>
          <p>
            Free-form labels — a post can carry many. Tags can also be created on the fly while writing
            a post; the slug is SEO-editable.
          </p>
        </div>
        <span className="workspace-index">BLOG</span>
      </div>

      <TagManager
        tags={tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          postCount: tag._count.posts,
          createdAt: tag.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
