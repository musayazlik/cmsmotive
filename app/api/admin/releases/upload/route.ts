import { after } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { announceRelease, deliverPendingEmails } from "@/lib/notifications";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import { readCompliance } from "@/lib/product-compliance";
import { r2Config } from "@/lib/package-storage-config";
import { getUploadSettings } from "@/lib/settings";
import { packageRequestSchema } from "@/lib/package-upload";
import { r2PackageStorage } from "@/lib/package-storage";
import { handlePackageUpload } from "@/lib/package-release-upload";
import { requestOrigin } from "@/lib/stores";

export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;
  if (request.headers.get("origin") !== requestOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const input = packageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return reply({ error: "Enter a valid version and a ZIP file between 1 byte and 128 MB." }, 400);
  const storeId = (await panelStore()).id;
  try {
    if ((await getUploadSettings(storeId)).packageProvider !== "r2") return reply({ error: "R2 package uploads are not enabled for this store." }, 409);
    const config = r2Config();
    if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) throw new Error("Set BETTER_AUTH_SECRET to at least 32 characters before uploading packages.");
    const result = await handlePackageUpload(input.data, { userId: session.user.id, storeId }, {
      bucket: config.bucket, storage: r2PackageStorage(),
      findProduct: async (id) => {
        const product = await prisma.product.findFirst({ where: { id, storeId }, select: { id: true, compliance: true } });
        return product ? { id: product.id, codeLicense: readCompliance(product.compliance).codeLicense } : null;
      },
      findRelease: (productId, version) => prisma.productRelease.findUnique({ where: { productId_version: { productId, version } }, select: { id: true, fileKey: true } }),
      createRelease: (data) => prisma.productRelease.create({ data, select: { id: true } }),
    });
    // The release exists only once the package is stored; tell its buyers after responding (repeats are no-ops).
    const releaseId = result.status === 200 && typeof result.data.releaseId === "string" ? result.data.releaseId : null;
    if (releaseId)
      after(async () => {
        try {
          await announceRelease(releaseId);
          await deliverPendingEmails();
        } catch (error) {
          console.error("release announcement failed", error instanceof Error ? error.message : error);
        }
      });
    return reply(result.data, result.status);
  } catch (error) {
    // Configuration errors contain setting names, never credentials.
    if (error instanceof Error && /^(R2_|R2 is not configured|Set BETTER_AUTH_SECRET)/.test(error.message)) return reply({ error: error.message }, 503);
    return reply({ error: "The package could not be registered. Try again." }, 503);
  }
}
