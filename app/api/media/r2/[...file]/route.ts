import { prisma } from "@/lib/prisma";
import { r2MediaStorage } from "@/lib/media-storage";
import { r2MediaReference } from "@/lib/media-upload-shared";

export const runtime = "nodejs";

/** Only registered public media is served here. The private packages/ prefix is never accepted. */
export async function GET(request: Request, context: { params: Promise<{ file: string[] }> }) {
  const fileKey = `r2://${(await context.params).file.join("/")}`;
  const ref = r2MediaReference(fileKey);
  if (!ref) return new Response("Not found", { status: 404 });
  // Media is public and may be referenced by copies in multiple stores.
  const asset = await prisma.mediaAsset.findFirst({ where: { key: fileKey }, select: { mimeType: true } });
  if (!asset || !/^(image|video)\//.test(asset.mimeType)) return new Response("Not found", { status: 404 });
  const range = request.headers.get("range") || undefined;
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response("Invalid range", { status: 416 });
  try {
    const object = await r2MediaStorage().read(ref.bucket, ref.key, range);
    const headers = new Headers({
      "Content-Type": asset.mimeType, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      "Cache-Control": "public, max-age=3600", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*",
    });
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
    if (object.ETag) headers.set("ETag", object.ETag);
    return new Response(object.Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined, { status: object.ContentRange ? 206 : 200, headers });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    return new Response(status === 404 ? "Not found" : status === 416 ? "Invalid range" : "Media is temporarily unavailable", { status: status === 404 || status === 416 ? status : 503 });
  }
}
