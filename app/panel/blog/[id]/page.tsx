import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostForm from "../_components/post-form";
import type { PostFormInitial } from "../_lib";
import type { SelectOption } from "@/app/panel/_components/ui/select";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [post, categories, tags] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: {
        cover: { select: { id: true, url: true, fileName: true } },
        tags: { select: { tagId: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!post) notFound();

  const initial: PostFormInitial = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    cover: post.cover ? { assetId: post.cover.id, url: post.cover.url, name: post.cover.fileName } : null,
    status: post.status as PostFormInitial["status"],
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    featured: post.featured,
    categoryId: post.categoryId,
    tagIds: post.tags.map(({ tagId }) => tagId),
  };

  const categoryOptions: SelectOption[] = categories.map((category) => ({ value: category.id, label: category.name }));
  const tagOptions: SelectOption[] = tags.map((tag) => ({ value: tag.id, label: tag.name }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / BLOG / EDIT
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Edit the <em>post.</em>
          </h1>
          <p>Update the content, media, SEO fields or publish state. Changes apply immediately after saving.</p>
        </div>
        <Link className="wbtn wbtn-ghost" href="/panel/blog">
          Back to posts
        </Link>
      </div>

      <PostForm initial={initial} categories={categoryOptions} tags={tagOptions} />
    </>
  );
}
