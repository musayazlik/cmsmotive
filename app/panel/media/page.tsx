import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { utapi, UT_MAX_FILES, UT_PAGE_SIZE } from "@/lib/utapi";
import MediaList from "./_components/media-list";
import { TableCardSkeleton } from "../_components/skeletons";
import { guessMimeType, type MediaRow, type MediaUsageInfo } from "./_lib";

export const dynamic = "force-dynamic";

/**
 * UploadThing caps listFiles per call, so the bucket is paged through
 * until it runs dry or the safety ceiling is hit. getUsageInfo stays the
 * authoritative source for the storage stats either way.
 */
type UtStorageFile = Awaited<ReturnType<typeof utapi.listFiles>>["files"][number];

async function listStorageFiles() {
  const files: UtStorageFile[] = [];
  let truncated = false;
  for (let offset = 0; files.length < UT_MAX_FILES; offset += UT_PAGE_SIZE) {
    const page = await utapi.listFiles({ limit: UT_PAGE_SIZE, offset });
    files.push(...page.files);
    if (!page.hasMore) break;
    truncated = true;
  }
  return { files, truncated };
}

/**
 * The bucket listing is the slow part (paged UploadThing calls, signed urls
 * and a usage round-trip), so it renders behind <Suspense> while the page
 * header paints immediately.
 */
async function MediaLibrary() {
  const [storage, assets] = await Promise.all([
    listStorageFiles().then(
      (result) => ({ result, error: null as string | null }),
      (error: unknown) => {
        console.error("media library: UploadThing list failed", error);
        return { result: null, error: error instanceof Error ? error.message : "request failed" };
      },
    ),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        url: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        _count: { select: { themeCovers: true, extensionCovers: true, postCovers: true, themeGallery: true, extensionGallery: true } },
      },
    }),
  ]);

  // Storage stats are what the plan bills against, so they come straight
  // from UploadThing rather than being summed from the table slice.
  let usage: MediaUsageInfo | null = null;
  if (storage.result) {
    try {
      const info = await utapi.getUsageInfo();
      usage = { filesUploaded: info.filesUploaded, totalBytes: info.totalBytes, limitBytes: info.limitBytes };
    } catch (error) {
      console.error("media library: UploadThing usage failed", error);
    }
  }

  const assetsByKey = new Map(assets.map((asset) => [asset.key, asset]));
  const rows: MediaRow[] = [];

  // Storage is the source of truth for what exists; the database adds
  // tracking, urls and usage on top. Files only in UploadThing are
  // "untracked" (they still render via a locally signed url), assets whose
  // storage copy vanished are "missing".
  if (storage.result) {
    for (const file of storage.result.files) {
      const asset = assetsByKey.get(file.key);
      let url = asset?.url ?? "";
      if (!asset) {
        try {
          url = (await utapi.generateSignedURL(file.key)).ufsUrl;
        } catch {
          url = "";
        }
      }
      rows.push({
        id: file.id,
        key: file.key,
        name: asset?.fileName ?? file.name,
        size: asset?.fileSize ?? file.size,
        mimeType: asset?.mimeType ?? guessMimeType(file.name),
        url,
        uploadedAt: new Date(file.uploadedAt).toISOString(),
        status: file.status,
        source: asset ? "tracked" : "untracked",
        usage: {
          themes: asset?._count.themeCovers ?? 0,
          extensions: asset?._count.extensionCovers ?? 0,
          posts: asset?._count.postCovers ?? 0,
          gallery: (asset?._count.themeGallery ?? 0) + (asset?._count.extensionGallery ?? 0),
        },
        uploader: asset?.uploadedBy?.name ?? null,
      });
      assetsByKey.delete(file.key);
    }
  }

  for (const asset of assetsByKey.values()) {
    rows.push({
      id: asset.id,
      key: asset.key,
      name: asset.fileName,
      size: asset.fileSize,
      mimeType: asset.mimeType,
      url: asset.url,
      uploadedAt: asset.createdAt.toISOString(),
      status: "Missing",
      source: "missing",
      usage: {
        themes: asset._count.themeCovers,
        extensions: asset._count.extensionCovers,
        posts: asset._count.postCovers,
        gallery: asset._count.themeGallery + asset._count.extensionGallery,
      },
      uploader: asset.uploadedBy?.name ?? null,
    });
  }

  return (
    <MediaList
      files={rows}
      usage={usage}
      utError={storage.error}
      truncated={storage.result?.truncated ?? false}
    />
  );
}

export default function MediaPage() {
  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CONTENT / MEDIA LIBRARY
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Media in <em>storage.</em>
          </h1>
          <p>
            Every file in the UploadThing bucket with its size, tracking state and where it is used. Search
            the library, copy URLs, upload new media and clean up files the database no longer references.
          </p>
        </div>
        <span className="workspace-index">MEDIA</span>
      </div>

      <Suspense fallback={<TableCardSkeleton rows={6} columns={6} />}>
        <MediaLibrary />
      </Suspense>
    </>
  );
}
