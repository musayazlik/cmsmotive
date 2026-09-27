import { prisma } from "@/lib/prisma";
import CategoryManager from "../_components/category-manager";

export const dynamic = "force-dynamic";

export default async function BlogCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / BLOG / CATEGORIES
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Blog <em>categories.</em>
          </h1>
          <p>
            The primary grouping for posts — a post belongs to at most one. Colors show up next to the
            category in lists; the slug is SEO-editable.
          </p>
        </div>
        <span className="workspace-index">BLOG</span>
      </div>

      <CategoryManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          color: category.color,
          postCount: category._count.posts,
          createdAt: category.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
