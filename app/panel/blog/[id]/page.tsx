import { requirePanelUser } from "@/lib/panel-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostForm from "../_components/post-form";
import type { CoverRef, PostFormInitial } from "../_lib";
import type { SelectOption } from "@/app/panel/_components/ui/select";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const { id } = await params;

  const [post, categories, tags, mediaAssets] = await Promise.all([
    prisma.post.findFirst({
      where: { id, storeId },
      include: {
        cover: { select: { id: true, url: true, fileName: true } },
        tags: { select: { tagId: true } },
      },
    }),
    prisma.category.findMany({ where: { storeId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { storeId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.mediaAsset.findMany({
      where: { storeId, mimeType: { startsWith: "image" } },
      orderBy: { createdAt: "desc" },
      take: 36,
      select: { id: true, url: true, fileName: true },
    }),
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
  const media: CoverRef[] = mediaAssets.map((asset) => ({ assetId: asset.id, url: asset.url, name: asset.fileName }));

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
      </div>

      <PostForm initial={initial} categories={categoryOptions} tags={tagOptions} media={media} />
    </>
  );
}
