import { createUploadthing, UploadThingError, type FileRouter } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreRole, isStoreAdmin } from "@/lib/store-access";
import { z } from "zod";
import { announceRelease } from "@/lib/notifications";
import { avatarFileKey } from "@/lib/avatar-file";
import type { Prisma } from "@/generated/prisma/client";
import { codeLicenseProblem } from "@/lib/code-license";
import { getLegalSettings } from "@/lib/legal";
import { auditFailureMessage, auditPackage } from "@/lib/package-audit";
import { readCompliance } from "@/lib/product-compliance";
import { panelStoreFromRequest } from "@/lib/panel-store";
import { getUploadSettings } from "@/lib/settings";
import { utapi } from "@/lib/utapi";

const f = createUploadthing();

/**
 * Resolves the signed-in admin from the request cookie. UploadThing's middleware
 * runs before the file is transferred, so unauthenticated uploads are rejected
 * at the edge rather than after the bytes arrive.
 */
async function requireAdminUpload(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new UploadThingError("Unauthorized");

  const storeId = (await panelStoreFromRequest(req)).id;
  if (!isStoreAdmin(await getStoreRole(session.user.id, storeId))) throw new UploadThingError("Forbidden");

  // The store the panel is editing receives the upload (lib/panel-store.ts).
  return { userId: session.user.id, storeId };
}

async function requireMediaUpload(req: Request, files: readonly { type: string }[]) {
  const actor = await requireAdminUpload(req);
  const settings = await getUploadSettings(actor.storeId);
  if (files.some((file) => (file.type.startsWith("video/") ? settings.videoProvider : settings.imageProvider) !== "uploadthing")) {
    throw new UploadThingError("This media type uses Cloudflare R2. Refresh the panel and try again.");
  }
  return actor;
}

/** Every upload lands in its store's MediaAsset library so the media library can track it. */
async function trackUpload({ userId, storeId }: { userId: string; storeId: string }, file: { key: string; ufsUrl: string; name: string; size: number; type: string }) {
  const asset = await prisma.mediaAsset.create({
    data: {
      storeId,
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
  productPackage: f({ blob: { maxFileSize: "128MB", maxFileCount: 1, acl: "private" } })
    .input(z.object({ productId: z.string().min(1), version: z.string().regex(/^[a-zA-Z0-9.+-]{1,40}$/) }))
    .middleware(async ({ req, input, files }) => {
      const { storeId } = await requireAdminUpload(req);
      if ((await getUploadSettings(storeId)).packageProvider !== "uploadthing") throw new UploadThingError("Use the configured package upload flow in the product panel.");
      if (files.some((file) => !file.name.toLowerCase().endsWith(".zip"))) throw new UploadThingError("Product packages must be ZIP files.");
      const product = await prisma.product.findFirst({
        where: { id: input.productId, storeId },
        select: { id: true, compliance: true },
      });
      const license = readCompliance(product?.compliance).codeLicense;
      if (!product || !license) throw new UploadThingError("Complete the product code-license checklist first.");
      const { gplCodeRequired } = await getLegalSettings(storeId);
      const licenseProblem = codeLicenseProblem(license, gplCodeRequired);
      if (licenseProblem) throw new UploadThingError(licenseProblem);
      if (await prisma.productRelease.findUnique({ where: { productId_version: { productId: product.id, version: input.version } } })) {
        throw new UploadThingError("This release version already exists. Upload a new version instead.");
      }
      return { productId: product.id, version: input.version, license, gplRequired: gplCodeRequired };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Licence audit before the file becomes a release; a refused package is removed again.
      const signed = await utapi.generateSignedURL(file.key, { expiresIn: 120 });
      const response = await fetch(signed.ufsUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new UploadThingError("The uploaded package could not be read for the licence check.");
      const audit = auditPackage(Buffer.from(await response.arrayBuffer()), { gplRequired: metadata.gplRequired, declaredLicense: metadata.license });
      if (audit.errors.length) {
        await utapi.deleteFiles(file.key).catch((error) => console.error("refused package cleanup failed", error instanceof Error ? error.message : error));
        return { releaseId: null, error: auditFailureMessage(audit) };
      }
      const release = await prisma.productRelease.create({
        data: {
          productId: metadata.productId, version: metadata.version, codeLicense: metadata.license, fileKey: file.key, fileName: file.name,
          audit: audit as Prisma.InputJsonObject,
        },
      });
      // Buyers are told in their account; a failure here is retried by the scheduled job.
      await announceRelease(release.id).catch((error) => console.error("release announcement failed", error instanceof Error ? error.message : error));
      // Private keys and URLs never enter MediaAsset or the public media library.
      return { releaseId: release.id, error: null };
    }),
  productMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
  })
    .middleware(({ req, files }) => requireMediaUpload(req, files))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Images and videos embedded in product descriptions. Cover and gallery
  // uploads stay on the image-only endpoint above.
  catalogContent: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req, files }) => requireMediaUpload(req, files))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Blog content media: images and videos embedded through the Tiptap editor,
  // plus the post cover.
  blogMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req, files }) => requireMediaUpload(req, files))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Standalone uploads from the media library itself.
  mediaLibrary: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req, files }) => requireMediaUpload(req, files))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Customer profile avatar: any signed-in user, one small image, no store scope.
  // The upload itself sets user.image, so no second request is needed.
  avatar: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async ({ req, files }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) throw new UploadThingError("Unauthorized");
      if (files.some((file) => !file.type.startsWith("image/"))) {
        throw new UploadThingError("Avatars must be image files.");
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const current = await prisma.user.findUnique({
        where: { id: metadata.userId },
        select: { image: true },
      });
      const updated = await prisma.user.update({
        where: { id: metadata.userId },
        data: { image: file.ufsUrl },
        select: { image: true },
      });
      const previous = current?.image;
      if (previous && previous !== updated.image) {
        const key = avatarFileKey(previous);
        if (key) {
          // Best effort: the previous avatar is no longer referenced anywhere.
          await utapi.deleteFiles(key).catch((error) =>
            console.error("avatar cleanup failed", error instanceof Error ? error.message : error),
          );
        }
      }
      return { url: updated.image ?? file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
