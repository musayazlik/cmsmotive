import { prisma } from "@/lib/prisma";
import PostForm from "../_components/post-form";
import type { CoverRef } from "../_lib";
import type { SelectOption } from "@/app/panel/_components/ui/select";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const [categories, tags, mediaAssets] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.mediaAsset.findMany({
      where: { mimeType: { startsWith: "image" } },
      orderBy: { createdAt: "desc" },
      take: 36,
      select: { id: true, url: true, fileName: true },
    }),
  ]);

  const categoryOptions: SelectOption[] = categories.map((category) => ({ value: category.id, label: category.name }));
  const tagOptions: SelectOption[] = tags.map((tag) => ({ value: tag.id, label: tag.name }));
  const media: CoverRef[] = mediaAssets.map((asset) => ({ assetId: asset.id, url: asset.url, name: asset.fileName }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / BLOG / NEW
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Write a <em>post.</em>
          </h1>
          <p>
            Draft the content in the rich editor, then tune the SEO title (60), description (160) and slug.
            Add a cover image, a category and tags before publishing.
          </p>
        </div>
      </div>

      <PostForm
        initial={{
          title: "",
          slug: "",
          excerpt: "",
          content: "",
          cover: null,
          status: "draft",
          scheduledAt: null,
          featured: false,
          categoryId: null,
          tagIds: [],
        }}
        categories={categoryOptions}
        tags={tagOptions}
        media={media}
      />
    </>
  );
}
