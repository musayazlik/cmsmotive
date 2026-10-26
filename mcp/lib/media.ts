import { prisma } from "@/lib/prisma";
import { deleteMediaFile, storeMediaFile } from "@/lib/media-storage";
import { ToolError } from "./result";
import { mcpStoreId } from "@/mcp/context";

/**
 * Media library operations. The panel uploads through UploadThing from the
 * browser; MCP clients have no browser session, so uploads are accepted as a
 * URL or base64 payload and pushed through the same server-side UTApi. Alt
 * text editing is also exposed here because it is the only MediaAsset field
 * that can be corrected without re-uploading the file.
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;

export type UploadMediaInput = {
  fileName: string;
  mimeType?: string;
  base64?: string;
  dataUrl?: string;
  url?: string;
};

export async function uploadMediaRecord(
  input: UploadMediaInput,
  uploadedById: string,
) {
  const sources = [input.url, input.dataUrl, input.base64].filter(Boolean);
  if (sources.length !== 1) {
    throw new ToolError("Provide exactly one of url, dataUrl or base64.");
  }

  let fileName = input.fileName.trim();
  let mimeType = input.mimeType?.trim() || "application/octet-stream";
  let buffer: Buffer;

  if (input.url) {
    const response = await fetch(input.url);
    if (!response.ok) {
      throw new ToolError(`Could not download the image: HTTP ${response.status}.`);
    }
    const header = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (header) mimeType = header;
    buffer = Buffer.from(await response.arrayBuffer());
    if (!fileName) {
      const pathname = new URL(input.url).pathname;
      fileName = pathname.split("/").pop() || "upload";
    }
  } else {
    const raw = input.dataUrl ?? input.base64 ?? "";
    const match = raw.match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (match) {
      mimeType = match[1];
      buffer = Buffer.from(match[2], "base64");
    } else {
      buffer = Buffer.from(raw, "base64");
    }
  }

  if (!fileName) throw new ToolError("fileName is required.");
  if (buffer.length === 0) throw new ToolError("The uploaded file is empty.");

  const limit = mimeType.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (buffer.length > limit) {
    throw new ToolError(
      `The file is too large. The limit is ${limit === MAX_VIDEO_BYTES ? "64 MB for videos" : "8 MB for images"}.`,
    );
  }

  const asset = await storeMediaFile(mcpStoreId(), uploadedById, new File([new Uint8Array(buffer)], fileName, { type: mimeType }));

  return { ...asset, createdAt: asset.createdAt.toISOString() };
}

export async function updateMediaRecord(
  id: string,
  input: { alt?: string | null },
) {
  const existing = await prisma.mediaAsset.findFirst({ where: { id, storeId: mcpStoreId() }, select: { id: true } });
  if (!existing) throw new ToolError("Media asset not found.");

  const data: { alt?: string | null } = {};
  if (input.alt !== undefined) {
    const alt = input.alt?.trim() ?? "";
    data.alt = alt || null;
  }
  if (Object.keys(data).length === 0) {
    throw new ToolError("Nothing to update. Provide alt.");
  }

  const asset = await prisma.mediaAsset.update({
    where: { id },
    data,
    select: {
      id: true,
      key: true,
      url: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      alt: true,
      width: true,
      height: true,
      createdAt: true,
    },
  });
  return { ...asset, createdAt: asset.createdAt.toISOString() };
}

export async function deleteMediaRecord(input: { id?: string; key?: string }) {
  let key = input.key?.trim() || undefined;
  let assetId: string | null = null;

  const storeId = mcpStoreId();
  if (input.id) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: input.id, storeId },
      select: { id: true, key: true },
    });
    if (!asset) throw new ToolError("Media asset not found.");
    key = asset.key;
    assetId = asset.id;
  }

  if (!key) throw new ToolError("Provide either id or key.");
  // One storage bucket serves every store: never delete a file another store owns.
  if (await prisma.mediaAsset.findFirst({ where: { key, storeId: { not: storeId } }, select: { id: true } })) {
    throw new ToolError("This file belongs to another store.");
  }

  // The panel removes the storage object first so a failed database delete
  // leaves a stale row (which is easier to clean up) instead of a dangling file.
  try {
    await deleteMediaFile(key);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolError(`The file could not be deleted from storage: ${message}`);
  }

  if (assetId) {
    await prisma.mediaAsset.delete({ where: { id: assetId } });
  } else {
    await prisma.mediaAsset.deleteMany({ where: { key, storeId } });
  }

  return { id: assetId, key, deleted: true };
}
