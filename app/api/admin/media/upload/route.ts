import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import { getUploadSettings } from "@/lib/settings";
import { packageStorageStatus, r2Config } from "@/lib/package-storage-config";
import { issueMediaReceipt, readMediaReceipt } from "@/lib/media-upload-receipt";
import { mediaObjectKey, r2MediaStorage } from "@/lib/media-storage";
import { mediaKindOf, mediaUploadSchema, r2MediaUrl } from "@/lib/media-upload-shared";
import { requestOrigin } from "@/lib/stores";

export const runtime = "nodejs";
const schema = z.union([mediaUploadSchema.and(z.object({ action: z.literal("prepare") })), z.object({ action: z.literal("complete"), receipt: z.string().min(1).max(8192) })]);
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const assetSelect = { id: true, url: true, fileName: true, mimeType: true } as const;
const uploaded = (asset: { id: string; url: string; fileName: string; mimeType: string }) => ({ assetId: asset.id, url: asset.url, name: asset.fileName, mimeType: asset.mimeType });

export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const settings = await getUploadSettings((await panelStore()).id);
  return reply({ imageProvider: settings.imageProvider, videoProvider: settings.videoProvider });
}

export async function POST(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  if (request.headers.get("origin") !== requestOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: parsed.error.issues[0].message }, 400);
  const input = parsed.data;
  const storeId = (await panelStore()).id;
  const actor = { storeId, userId: session.user.id };
  const status = packageStorageStatus("r2");
  if (!status.configured) return reply({ error: status.error }, 503);
  const config = r2Config();
  const storage = r2MediaStorage();
  try {
    if (input.action === "prepare") {
      const settings = await getUploadSettings(storeId);
      const provider = mediaKindOf(input.mimeType) === "video" ? settings.videoProvider : settings.imageProvider;
      if (provider !== "r2") return reply({ error: "This upload type uses UploadThing. Refresh the panel and try again." }, 409);
      const key = mediaObjectKey(storeId, input.mimeType);
      return reply({ url: await storage.uploadUrl(config.bucket, key, input.mimeType, input.fileSize), receipt: issueMediaReceipt({ ...input, ...actor, bucket: config.bucket, key }) });
    }
    const receipt = readMediaReceipt(input.receipt, actor);
    if (!receipt || receipt.bucket !== config.bucket) return reply({ error: "The upload expired or belongs to another account or store. Upload the file again." }, 403);
    const reference = `r2://${receipt.bucket}/${receipt.key}`;
    const existing = await prisma.mediaAsset.findUnique({ where: { storeId_key: { storeId, key: reference } }, select: assetSelect });
    if (existing) return reply(uploaded(existing));
    const object = await storage.inspect(receipt.bucket, receipt.key);
    if (object.ContentLength !== receipt.fileSize || object.ContentType !== receipt.mimeType || !object.ETag) return reply({ error: "Uploaded file does not match the selected media. Upload it again." }, 400);
    await storage.promote(receipt.bucket, receipt.key, receipt.mimeType, object.ETag);
    const asset = await prisma.mediaAsset.upsert({
      where: { storeId_key: { storeId, key: reference } }, update: {},
      create: { storeId, uploadedById: actor.userId, key: reference, url: r2MediaUrl(reference), fileName: receipt.fileName, fileSize: receipt.fileSize, mimeType: receipt.mimeType }, select: assetSelect,
    });
    await storage.remove(receipt.bucket, `staging/${receipt.key}`).catch(() => console.error("R2 media staging cleanup failed."));
    return reply(uploaded(asset));
  } catch {
    return reply({ error: "The media upload could not be completed. Check storage access and try again." }, 502);
  }
}
