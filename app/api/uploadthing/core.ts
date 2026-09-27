import { createUploadthing, UploadThingError, type FileRouter } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

/**
 * Resolves the signed-in admin from the request cookie. UploadThing's middleware
 * runs before the file is transferred, so unauthenticated uploads are rejected
 * at the edge rather than after the bytes arrive.
 */
async function requireAdminUpload(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new UploadThingError("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (user?.role !== "admin") throw new UploadThingError("Forbidden");

  return { userId: user.id };
}

/** Every upload lands in MediaAsset so the media library can track it. */
async function trackUpload(userId: string, file: { key: string; ufsUrl: string; name: string; size: number; type: string }) {
  const asset = await prisma.mediaAsset.create({
    data: {
      key: file.key,
      url: file.ufsUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedById: userId,
    },
    select: { id: true },
  });
  return { assetId: asset.id, url: file.ufsUrl };
}

export const uploadRouter = {
  themeMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata.userId, file)),

  extensionMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata.userId, file)),

  // Blog content media: images and videos embedded through the Tiptap editor,
  // plus the post cover.
  blogMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata.userId, file)),

  // Standalone uploads from the media library itself.
  mediaLibrary: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata.userId, file)),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
