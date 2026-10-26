import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packageDownloadUrl } from "@/lib/package-storage";
import { creemMode } from "@/lib/creem";
import { entitlementCovers } from "@/lib/billing-access";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified)
    return new Response("Unauthorized", { status: 401 });
  const release = await prisma.productRelease.findUnique({
    where: { id: (await params).id },
  });
  if (!release) return new Response("Not found", { status: 404 });
  // Any of the account's purchases of this product (any store, this payment mode) may cover the release.
  const entitlements = await prisma.entitlement.findMany({
    where: {
      productId: release.productId,
      revokedAt: null,
      customer: { userId: session.user.id, mode: creemMode() },
    },
    select: { revokedAt: true, updatesUntil: true },
  });
  if (!entitlements.some((entitlement) => entitlementCovers(entitlement, release)))
    return new Response("No download entitlement", { status: 403 });
  try {
    const url = await packageDownloadUrl(release.fileKey, release.fileName);
    return new Response(null, {
      status: 303,
      headers: {
        Location: url,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("The download is temporarily unavailable.", {
      status: 503,
    });
  }
}
