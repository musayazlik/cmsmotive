import { createUploadthing, UploadThingError, type FileRouter } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/admin-guard";
import { z } from "zod";
import { readCompliance } from "@/lib/product-compliance";
import { panelStoreFromRequest } from "@/lib/panel-store";

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
  // Same roles as the panel guard (lib/admin-guard.ts): superadmins upload too.
  if (!user || !isAdminRole(user.role)) throw new UploadThingError("Forbidden");

  // The store the panel is editing receives the upload (lib/panel-store.ts).
  return { userId: user.id, storeId: (await panelStoreFromRequest(req)).id };
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
    .input(z.object({ kind:z.enum(["theme","extension"]), productSlug:z.string().regex(/^[a-z0-9-]+$/), version:z.string().regex(/^[a-zA-Z0-9.+-]{1,40}$/) }))
    .middleware(async ({req,input,files})=>{
      const { storeId } = await requireAdminUpload(req);
      if(files.some(file=>!file.name.toLowerCase().endsWith(".zip")))throw new UploadThingError("Product packages must be ZIP files.");
      const product=input.kind==="theme"?await prisma.theme.findUnique({where:{storeId_slug:{storeId,slug:input.productSlug}}}):await prisma.extension.findUnique({where:{storeId_slug:{storeId,slug:input.productSlug}}});
      const license=readCompliance(product?.compliance).codeLicense;
      if(!product || !["GPL-2.0-or-later","GPL-3.0-or-later"].includes(license))throw new UploadThingError("Complete the product code-license checklist first.");
      if(await prisma.productRelease.findUnique({where:{storeId_kind_productSlug_version:{storeId,...input}}}))throw new UploadThingError("This release version already exists. Upload a new version instead.");
      return {...input,license,storeId};
    })
    .onUploadComplete(async ({metadata,file})=>{
      const release=await prisma.productRelease.create({data:{storeId:metadata.storeId,kind:metadata.kind,productSlug:metadata.productSlug,version:metadata.version,codeLicense:metadata.license,fileKey:file.key,fileName:file.name}});
      // Private keys and URLs never enter MediaAsset or the public media library.
      return {releaseId:release.id};
    }),
  themeMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  extensionMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Images and videos embedded in theme and extension descriptions. Cover and
  // gallery uploads stay on the image-only endpoints above.
  catalogContent: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Blog content media: images and videos embedded through the Tiptap editor,
  // plus the post cover.
  blogMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),

  // Standalone uploads from the media library itself.
  mediaLibrary: f({
    image: { maxFileSize: "8MB", maxFileCount: 12 },
    video: { maxFileSize: "64MB", maxFileCount: 4 },
  })
    .middleware(({ req }) => requireAdminUpload(req))
    .onUploadComplete(async ({ metadata, file }) => trackUpload(metadata, file)),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
